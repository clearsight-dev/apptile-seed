// This file is executed in android/app/apptile.gradle during before android build
// It takes things from apptile.config.json and puts the things in the configuration files of the ios project
// It also generates code wherever necessary
// ----------------------------------------------------
//
// Make sure this script is idempotent. Meaning you can run it at any time and with any configurations and it should
// Update the project with the values in the apptile.config.json without having to reason about things in the codebase itself
// This means you cannot rely on comments in the codebase that will get uncommented or specialized strings that get replaced.
// If you do that, then when you run the script a second time those comments are gone and the script will fail.
// You must guarantee that the developer of the project can run this script with any changes in apptile.config.json and not
// have to worry about getting into an irrecoverable state from which recovery is only possible by checking out another version
// of the project. This is what used to happen in the /temp folder strategy and that strategy is painful enough to discourage
// most developers from even running projects with all features specific to the app enabled.

const chalk = require('chalk');
const xml2js = require('xml2js');
const path = require('path');
const os = require('os');
const axios = require('axios');
const util = require('util');
const {exec: exec_} = require('child_process');
const {readFile, writeFile, mkdir} = require('node:fs/promises');

const {
  downloadFile,
  analyticsTemplate,
  generateAnalytics,
  removeForceUnlinkForNativePackage,
  addForceUnlinkForNativePackage,
  readReactNativeConfigJs,
  writeReactNativeConfigJs,
  getExtraModules,
  downloadIconAndSplash,
} = require('./commonProjectSetup');

const exec = util.promisify(exec_);

console.log('Using OTA Fix')

async function generateIconSet(scriptPath) {
  await exec(
    `${scriptPath} ${path.resolve(
      __dirname,
      'assets',
      'icon.png',
    )} ./android/app/src/main`,
    {cwd: path.resolve(__dirname)},
  );
}

function escapeAndroidXmlString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  // Android XML strings use backslash escaping for apostrophes and quotes
  // xml2js.Builder will handle other XML entities (&, <, >) automatically
  return str
    .replace(/'/g, "\\'") // Escape apostrophes with backslash
    .replace(/"/g, '\\"'); // Escape quotes with backslash
}

function upsertInStringsXML(parsedXMLDoc, key, value) {
  // Escape apostrophes for Android XML strings
  const escapedValue = escapeAndroidXmlString(value);

  let existingEntry = parsedXMLDoc.resources.string.find(
    it => it.$.name === key,
  );
  if (!existingEntry) {
    parsedXMLDoc.resources.string.push({
      _: escapedValue,
      $: {
        name: key,
      },
    });
  } else {
    existingEntry._ = escapedValue;
  }
}

function removeFromStringsXML(parsedXMLDoc, key) {
  let existingEntryIndex = parsedXMLDoc.resources.string.findIndex(
    it => it.$.name === key,
  );
  if (existingEntryIndex >= 0) {
    parsedXMLDoc.resources.string.splice(existingEntryIndex, 1);
  }
}

function getMainActivity(androidManifest) {
  const activities = androidManifest.manifest.application[0].activity;
  let mainActivity = null;
  for (let i = 0; i < activities.length; ++i) {
    const activity = activities[i];
    if (activity.$['android:name'] === '.LauncherActivity') {
      mainActivity = activity;
      break;
    }
  }
  return mainActivity;
}

// function getMainActivity(manifest) {
//   const application = manifest.manifest.application[0];
//   return application.activity.find(it => {
//     return it.$['android:name'] === '.LauncherActivity';
//   });
// }

function addIntent(activity, actionName, attributes, categories, schemes) {
  activity['intent-filter'] = activity['intent-filter'] || [];
  activity['intent-filter'].push({
    $: attributes,
    action: [{$: {'android:name': 'android.intent.action.' + actionName}}],
    category: categories.map(category => {
      return {$: {'android:name': 'android.intent.category.' + category}};
    }),
    data: schemes.map(scheme => {
      return {$: {'android:scheme': scheme}};
    }),
  });
}

function deleteIntentByScheme(activity, requiredSchemes) {
  if (activity['intent-filter']) {
    const index = activity['intent-filter'].findIndex(intent => {
      const schemes = {};
      if (!intent.data) {
        return false;
      } else {
        for (let i = 0; i < intent.data.length; ++i) {
          const scheme = intent.data[i].$['android:scheme'];
          schemes[scheme] = 1;
        }

        let allRequiredSchemesExist = true;
        for (let i = 0; i < requiredSchemes.length; ++i) {
          if (!schemes[requiredSchemes[i]]) {
            allRequiredSchemesExist = false;
            break;
          }
        }
        return allRequiredSchemesExist;
      }
    });

    if (index >= 0) {
      activity['intent-filter'].splice(index, 1);
    }
  }
}

// will delete intent which has all mentioned categories
function deleteIntentByCategory(activity, categories) {
  if (activity['intent-filter']) {
    const index = activity['intent-filter'].findIndex(intent => {
      const categoryNames = {};
      for (let i = 0; i < intent.category.length; ++i) {
        const categoryName = intent.category[i].$['android:name'];
        categoryNames[categoryName] = 1;
      }

      let allRequiredCategoriesMatch = true;
      for (let i = 0; i < categories.length; ++i) {
        if (!categoryNames[`android.intent.category.${categories[i]}`]) {
          allRequiredCategoriesMatch = false;
          break;
        }
      }
      return allRequiredCategoriesMatch;
    });

    if (index >= 0) {
      activity['intent-filter'].splice(index, 1);
    }
  }
}

function addDeeplinkScheme(androidManifest, urlScheme) {
  const mainActivity = getMainActivity(androidManifest);

  const intentFilters = mainActivity['intent-filter'];
  let targetIntent = null;
  for (let i = 0; i < intentFilters.length; ++i) {
    const intent = intentFilters[i];
    const actions = intent.action.reduce((acts, act) => {
      acts[act.$['android:name']] = 1;
      return acts;
    }, {});

    const categories = intent.category.reduce((cats, cat) => {
      cats[cat.$['android:name']] = 1;
      return cats;
    }, {});

    if (
      actions['android.intent.action.VIEW'] &&
      categories['android.intent.category.DEFAULT'] &&
      categories['android.intent.category.BROWSABLE']
    ) {
      targetIntent = intent;
      break;
    }
  }

  if (targetIntent) {
    targetIntent.data[0].$['android:scheme'] = urlScheme;
  } else {
    mainActivity['intent-filter'].push({
      action: [
        {
          $: {'android:name': 'android.intent.action.VIEW'},
        },
      ],
      category: [
        {
          $: {'android:name': 'android.intent.category.DEFAULT'},
        },
        {
          $: {'android:name': 'android.intent.category.BROWSABLE'},
        },
      ],
      data: [
        {
          $: {'android:scheme': urlScheme},
        },
      ],
    });
  }
}

function deleteAndroidScheme(androidManifest) {
  const mainActivity = getMainActivity(androidManifest);

  const intentFilters = mainActivity['intent-filter'];
  let deepLinkIntentIndex = -1;
  for (let i = 0; i < intentFilters.length; ++i) {
    const intent = intentFilters[i];
    const actions = intent.action.reduce((acts, act) => {
      acts[act.$['android:name']] = 1;
      return acts;
    }, {});

    const categories = intent.category.reduce((cats, cat) => {
      cats[cat.$['android:name']] = 1;
      return cats;
    }, {});

    if (
      actions['android.intent.action.VIEW'] &&
      categories['android.intent.category.DEFAULT'] &&
      categories['android.intent.category.BROWSABLE']
    ) {
      deepLinkIntentIndex = i;
      break;
    }
  }
  if (deepLinkIntentIndex >= 0) {
    intentFilters.splice(deepLinkIntentIndex, 1);
  }
}

function addHttpDeepLinks(androidManifest, hosts, useIntentFilters = false) {
  const mainActivity = getMainActivity(androidManifest);
  if (useIntentFilters) {
    console.log('Applying intent filters for http deep links');
  }
  if (!mainActivity['intent-filter']) {
    mainActivity['intent-filter'] = [];
  }

  // Remove any existing HTTP/HTTPS intent filters first
  mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(
    intent => {
      if (!intent.data) {
        return true;
      }
      const schemes = intent.data.reduce((schemes, data) => {
        schemes[data.$['android:scheme']] = 1;
        return schemes;
      }, {});
      // Remove if it has http and https schemes
      return !(schemes.http && schemes.https);
    },
  );

  // Expand wildcard hosts and filter out account subdomain
  // This ensures account.domain.com (used for Google login) opens in browser
  const expandedHosts = [];
  const baseHost = hosts[0];

  hosts.forEach(host => {
    if (host.startsWith('*.')) {
      // Expand wildcard to specific subdomains (excluding account.*)
      // Add www subdomain
      expandedHosts.push(`www.${baseHost}`);
      // Add the base domain too
      if (!expandedHosts.includes(baseHost)) {
        expandedHosts.push(baseHost);
      }
    } else if (host !== `account.${baseHost}`) {
      // Add all other hosts except account subdomain
      if (!expandedHosts.includes(host)) {
        expandedHosts.push(host);
      }
    }
  });

  const hostDataNodes = expandedHosts.map(host => {
    return {$: {'android:host': host}};
  });

  // Helper to create an intent-filter
  const createIntentFilter = dataNodes => ({
    $: {
      'android:autoVerify': 'true',
    },
    action: [
      {
        $: {'android:name': 'android.intent.action.VIEW'},
      },
    ],
    category: [
      {
        $: {'android:name': 'android.intent.category.DEFAULT'},
      },
      {
        $: {'android:name': 'android.intent.category.BROWSABLE'},
      },
    ],
    data: dataNodes,
  });

  if (useIntentFilters) {
    // New logic: Separate intent-filters for /, /products/, /collections/

    // 1. Intent-filter for homepage "/" - needed for Google Login redirect
    mainActivity['intent-filter'].push(
      createIntentFilter([
        {$: {'android:scheme': 'https'}},
        {$: {'android:scheme': 'http'}},
        {$: {'android:path': '/'}},
        ...hostDataNodes,
      ]),
    );

    // 2. Intent-filter for /products/ prefix
    mainActivity['intent-filter'].push(
      createIntentFilter([
        {$: {'android:scheme': 'https'}},
        {$: {'android:scheme': 'http'}},
        {$: {'android:pathPrefix': '/products/'}},
        ...hostDataNodes,
      ]),
    );

    // 3. Intent-filter for /collections/ prefix
    mainActivity['intent-filter'].push(
      createIntentFilter([
        {$: {'android:scheme': 'https'}},
        {$: {'android:scheme': 'http'}},
        {$: {'android:pathPrefix': '/collections/'}},
        ...hostDataNodes,
      ]),
    );
  } else {
    // Old logic: Single intent-filter with all hosts (opens all URLs in app)
    // But excludes account.* subdomain for Google login to work
    mainActivity['intent-filter'].push(
      createIntentFilter([
        {$: {'android:scheme': 'https'}},
        {$: {'android:scheme': 'http'}},
        ...hostDataNodes,
      ]),
    );
  }

  console.log(
    chalk.green(
      'HTTP deep links configured (account.* subdomain excluded for Google login)',
    ),
  );
}

function deleteHttpDeepLinks(androidManifest) {
  const mainActivity = getMainActivity(androidManifest);
  if (!mainActivity['intent-filter']) {
    mainActivity['intent-filter'] = [];
  }
  let existingIntentIndex = mainActivity['intent-filter'].findIndex(intent => {
    if (!intent.data) {
      return false;
    }
    const schemes = intent.data.reduce((schemes, data) => {
      schemes[data.$['android:scheme']] = 1;
      return schemes;
    }, {});
    return schemes.http && schemes.https;
  });

  if (existingIntentIndex >= 0) {
    mainActivity['intent-filter'].splice(existingIntentIndex, 1);
  }
}

function addPermission(androidManifest, permissionName) {
  androidManifest.manifest['uses-permission'] =
    androidManifest.manifest['uses-permission'] || [];
  const existingPermission = androidManifest.manifest['uses-permission'].find(
    permission => {
      return (
        permission.$['android:name'] === `android.permission.${permissionName}`
      );
    },
  );
  if (!existingPermission) {
    androidManifest.manifest['uses-permission'].push({
      $: {'android:name': `android.permission.${permissionName}`},
    });
  }
}

function deletePermission(androidManifest, permissionName) {
  androidManifest.manifest['uses-permission'] =
    androidManifest.manifest['uses-permission'] || [];
  const existingIndex = androidManifest.manifest['uses-permission'].findIndex(
    permission => {
      return (
        permission.$['android:name'] === `android.permission.${permissionName}`
      );
    },
  );
  if (existingIndex >= 0) {
    androidManifest.manifest['uses-permission'].splice(existingIndex, 1);
  }
}

function addFeature(androidManifest, featureAttributes) {
  androidManifest.manifest['uses-feature'] =
    androidManifest.manifest['uses-feature'] || [];

  // Check if feature already exists by comparing all attributes
  const existingFeature = androidManifest.manifest['uses-feature'].find(
    feature => {
      // Compare all attributes to determine if it's the same feature
      const featureAttrs = feature.$;
      return Object.keys(featureAttributes).every(
        key => featureAttrs[key] === featureAttributes[key],
      );
    },
  );

  if (!existingFeature) {
    androidManifest.manifest['uses-feature'].push({
      $: featureAttributes,
    });
  }
}

function deleteFeature(androidManifest, featureAttributes) {
  androidManifest.manifest['uses-feature'] =
    androidManifest.manifest['uses-feature'] || [];

  const existingIndex = androidManifest.manifest['uses-feature'].findIndex(
    feature => {
      // Compare all attributes to determine if it's the same feature
      const featureAttrs = feature.$;
      return Object.keys(featureAttributes).every(
        key => featureAttrs[key] === featureAttributes[key],
      );
    },
  );

  if (existingIndex >= 0) {
    androidManifest.manifest['uses-feature'].splice(existingIndex, 1);
  }
}

function addMetadata(androidManifest, androidName, androidValue) {
  androidManifest.manifest.application[0]['meta-data'] =
    androidManifest.manifest.application[0]['meta-data'] || [];
  const metaDataNodes = androidManifest.manifest.application[0]['meta-data'];
  const existingNode = metaDataNodes.find(
    node => node.$['android:name'] === androidName,
  );
  if (existingNode) {
    existingNode.$['android:value'] = androidValue;
  } else {
    metaDataNodes.push({
      $: {
        'android:name': androidName,
        'android:value': androidValue,
      },
    });
  }
}

function deleteMetadata(androidManifest, androidName) {
  const metaDataNodes = androidManifest.manifest.application[0]['meta-data'];
  if (metaDataNodes) {
    const index = metaDataNodes.findIndex(
      it => it.$['android:name'] === androidName,
    );
    if (index >= 0) {
      metaDataNodes.splice(index, 1);
    }
  }
}

function addService(androidManifest, serviceName, attributes, children) {
  androidManifest.manifest.application[0].service =
    androidManifest.manifest.application[0].service || [];
  let existingService = androidManifest.manifest.application[0].service.find(
    it => {
      return it.$['android:name'] === serviceName;
    },
  );
  if (existingService) {
    for (let key in existingService) {
      delete existingService[key];
    }
  } else {
    existingService = {};
    androidManifest.manifest.application[0].service.push(existingService);
  }

  existingService.$ = {
    'android:name': serviceName,
    ...attributes,
  };
  if (children !== null) {
    for (let key in children) {
      existingService[key] = children[key];
    }
  }
}

function deleteService(androidManifest, serviceName) {
  const services = androidManifest.manifest.application[0].service;
  if (services) {
    const index = services.findIndex(
      service => service.$['android:name'] === serviceName,
    );
    if (index >= 0) {
      services.splice(index, 1);
    }
  }
}

// Deletes the service that has the intent
/**
 * <intent-filter>
 *  <action android:name="com.google.firebase.MESSAGING_EVENT" />
 * </intent-filter>
 */
function deleteMessagingService(androidManifest) {
  const application = androidManifest.manifest.application[0];
  application.service = application.service || [];
  const index = application.service.findIndex(service => {
    service['intent-filter'] = service['intent-filter'] || [];
    const intentFilters = service['intent-filter'];
    const intent = intentFilters.find(intent => {
      intent.action = intent.action || [];
      let actionWithFirebaseMessagingEvent = intent.action.find(action => {
        return (
          action.$['android:name'] === 'com.google.firebase.MESSAGING_EVENT'
        );
      });
      return !!actionWithFirebaseMessagingEvent;
    });
    return !!intent;
  });

  if (index >= 0) {
    application.service.splice(index, 1);
  }
}

const firebaseMessagingEventIntent = {
  'intent-filter': [
    {
      action: [
        {
          $: {'android:name': 'com.google.firebase.MESSAGING_EVENT'},
        },
      ],
    },
  ],
};

async function addCleverTap(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const LOG_PREFIX = '[CleverTap][Android]';
  if(!apptileConfig.integrations.cleverTap) {
    console.log(chalk.red(`${LOG_PREFIX} CleverTap is enabled but seems like its not connected`));
    throw new Error('Missing apptileConfig.integrations.cleverTap object not found');
  }
  console.log(`${LOG_PREFIX} Initializing CleverTap integration`);
  const cleverTapIntegration = apptileConfig.integrations.cleverTap;
  if(!cleverTapIntegration.cleverTap_id) {
    console.log(chalk.red(`${LOG_PREFIX} CleverTap is connected but its account id is missing`));
    throw new Error('cleverTap_id is not found inside apptileConfig.integrations.cleverTap');
  }
  if(!cleverTapIntegration.cleverTap_token) {
    console.log(chalk.red(`${LOG_PREFIX} CleverTap is connected but its token is missing`));
    throw new Error('cleverTap_token is not found inside apptileConfig.integrations.cleverTap');
  }
  if(!cleverTapIntegration.cleverTap_region) {
    console.log(chalk.red(`${LOG_PREFIX} CleverTap is connected but its region is missing`));
    throw new Error('cleverTap_region is not found inside apptileConfig.integrations.cleverTap');
  }
  console.log(`${LOG_PREFIX} Adding CleverTap metadata to AndroidManifest`);
  addMetadata(
    androidManifest,
    'CLEVERTAP_ACCOUNT_ID',
    cleverTapIntegration.cleverTap_id,
  );
  addMetadata(
    androidManifest,
    'CLEVERTAP_TOKEN',
    cleverTapIntegration.cleverTap_token,
  );
  addMetadata(
    androidManifest,
    'CLEVERTAP_REGION',
    cleverTapIntegration.cleverTap_region,
  );
  deleteMessagingService(androidManifest);
  addService(
    androidManifest,
    'com.clevertap.android.sdk.pushnotification.fcm.FcmMessageListenerService',
    {'android:exported': true},
    firebaseMessagingEventIntent,
  );
  addPermission(androidManifest, 'ACCESS_NETWORK_STATE');
  await removeForceUnlinkForNativePackage(
    'clevertap-react-native',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} CleverTap integration complete`);
}

async function removeCleverTap(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  deleteMetadata(androidManifest, 'CLEVERTAP_ACCOUNT_ID');
  deleteMetadata(androidManifest, 'CLEVERTAP_TOKEN');
  deleteMetadata(androidManifest, 'CLEVERTAP_REGION');
  deleteService(
    androidManifest,
    'com.clevertap.android.sdk.pushnotification.fcm.FcmMessageListenerService',
  );
  deletePermission(androidManifest, 'ACCESS_NETWORK_STATE');
  await addForceUnlinkForNativePackage(
    'clevertap-react-native',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addFacebook(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const LOG_PREFIX = '[Facebook][Android]';
  if(!apptileConfig.integrations.metaAds) {
    console.log(chalk.red(`${LOG_PREFIX} Facebook is enabled but seems like its not connected`));
    throw new Error('Missing apptileConfig.integrations.metaAds object not found');
  }
  console.log(`${LOG_PREFIX} Initializing Facebook integration`);
  const facebookIntegration = apptileConfig.integrations.metaAds;
  if(!facebookIntegration.fb_appId) {
    console.log(chalk.red(`${LOG_PREFIX} Facebook is connected but its app id is missing`));
    throw new Error('fb_appId is not found inside apptileConfig.integrations.metaAds');
  }
  upsertInStringsXML(
    stringsObj,
    'facebook_app_id',
    facebookIntegration.fb_appId,
  );
  addMetadata(
    androidManifest,
    'com.facebook.sdk.ApplicationId',
    '@string/facebook_app_id',
  );

  if(!facebookIntegration.fb_clientToken) {
    console.log(chalk.red(`${LOG_PREFIX} Facebook is connected but its client token is missing`));
    throw new Error('fb_clientToken is not found inside apptileConfig.integrations.metaAds');
  }
  upsertInStringsXML(
    stringsObj,
    'facebook_client_token',
    facebookIntegration.fb_clientToken,
  );
  addMetadata(
    androidManifest,
    'com.facebook.sdk.ClientToken',
    '@string/facebook_client_token',
  );

  await removeForceUnlinkForNativePackage(
    'react-native-fbsdk-next',
    extraModules,
    parsedReactNativeConfig,
  );

  console.log(`${LOG_PREFIX} Facebook integration complete`);
}

async function removeFacebook(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  removeFromStringsXML(stringsObj, 'facebook_app_id');
  deleteMetadata(androidManifest, 'com.facebook.sdk.ApplicationId');

  removeFromStringsXML(stringsObj, 'facebook_client_token');
  deleteMetadata(androidManifest, 'com.facebook.sdk.ClientToken');

  await addForceUnlinkForNativePackage(
    'react-native-fbsdk-next',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addOnesignal(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const LOG_PREFIX = '[OneSignal][Android]';
  if(!apptileConfig.integrations.oneSignal) {
    chalk.red(`${LOG_PREFIX} OneSignal is enabled but seems like its not connected`);
    throw new Error('Mssing apptileConfig.integrations.oneSignal object not found');
  }
  console.log(`${LOG_PREFIX} Initializing OneSignal integration`);
  
  const onesignalIntegration = apptileConfig.integrations.oneSignal;
  if(!onesignalIntegration.onesignal_app_id) {
    console.log(chalk.red('OneSignal is connected but its app id is missing'));
    throw new Error('onesignal_app_id is not found inside apptileConfig.integrations.oneSignal');
  }
  upsertInStringsXML(
    stringsObj,
    'ONESIGNAL_APPID',
    onesignalIntegration.onesignal_app_id,
  );
  await removeForceUnlinkForNativePackage(
    'react-native-onesignal',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} OneSignal integration complete`);
}

async function removeOnesignal(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  removeFromStringsXML(stringsObj, 'ONESIGNAL_APPID');
  await addForceUnlinkForNativePackage(
    'react-native-onesignal',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addLogrocket(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const LOG_PREFIX = '[LogRocket][Android]';
  // LogRocket is initialized in JS (App.tsx), no native config needed
  upsertInStringsXML(stringsObj, 'ENABLE_LOGROCKET', 'true');
  await removeForceUnlinkForNativePackage(
    '@logrocket/react-native',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeLogrocket(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  removeFromStringsXML(stringsObj, 'ENABLE_LOGROCKET');

  // LogRocket is initialized in JS (App.tsx), no native config needed
  await addForceUnlinkForNativePackage(
    '@logrocket/react-native',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addMoengage(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const LOG_PREFIX = '[MoEngage][Android]';
  if(!apptileConfig.integrations.moengage) {
    console.log(chalk.red(`${LOG_PREFIX} MoEngage is enabled but seems like its not connected`));
    throw new Error('Missing apptileConfig.integrations.moengage object not found');
  }
  console.log(`${LOG_PREFIX} Initializing MoEngage integration`);
  const moengageIntegration = apptileConfig.integrations.moengage;
  if(!moengageIntegration.appId) {
    console.log(chalk.red(`${LOG_PREFIX} MoEngage is connected but its app id is missing`));
    throw new Error('appId is not found inside apptileConfig.integrations.moengage');
  }
  upsertInStringsXML(stringsObj, 'moengage_app_id', moengageIntegration.appId);
  if(!moengageIntegration.datacenter) {
    console.log(chalk.red(`${LOG_PREFIX} MoEngage is connected but its datacenter is missing`));
    throw new Error('datacenter is not found inside apptileConfig.integrations.moengage');
  }
  upsertInStringsXML(
    stringsObj,
    'moengage_datacenter',
    moengageIntegration.datacenter,
  );
  console.log(`${LOG_PREFIX} Adding MoEngage service to AndroidManifest`);
  deleteMessagingService(androidManifest);
  addService(
    androidManifest,
    'com.moengage.firebase.MoEFireBaseMessagingService',
    {'android:exported': true},
    firebaseMessagingEventIntent,
  );
  addPermission(androidManifest, 'SCHEDULE_EXACT_ALARM');
  await removeForceUnlinkForNativePackage(
    'react-native-moengage',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} MoEngage integration complete`);
}

async function removeMoengage(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  removeFromStringsXML(stringsObj, 'moengage_app_id');
  removeFromStringsXML(stringsObj, 'moengage_datacenter');
  deleteService(
    androidManifest,
    'com.moengage.firebase.MoEFireBaseMessagingService',
  );
  deletePermission(androidManifest, 'SCHEDULE_EXACT_ALARM');
  await addForceUnlinkForNativePackage(
    'react-native-moengage',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addKlaviyo(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const LOG_PREFIX = '[Klaviyo][Android]';
  if(!apptileConfig.integrations.klaviyo) {
    console.log(chalk.red(`${LOG_PREFIX} Klaviyo is enabled but seems like its not connected`));
    throw new Error('Missing apptileConfig.integrations.klaviyo object not found');
  }
  console.log(`${LOG_PREFIX} Initializing Klaviyo integration`);
  const klaviyoCompanyId =
    apptileConfig.integrations.klaviyo.klaviyo_company_id;
  if(!klaviyoCompanyId) {
    console.log(chalk.red(`${LOG_PREFIX} Klaviyo is connected but its company id is missing`));
    throw new Error('klaviyo_company_id is not found inside apptileConfig.integrations.klaviyo');
  }
  upsertInStringsXML(stringsObj, 'klaviyo_company_id', klaviyoCompanyId);
  console.log(`${LOG_PREFIX} Adding Klaviyo service to AndroidManifest`);
  addService(
    androidManifest,
    'com.klaviyo.pushFcm.KlaviyoPushService',
    {'android:exported': false},
    firebaseMessagingEventIntent,
  );
  removeForceUnlinkForNativePackage(
    'klaviyo-react-native-sdk',
    extraModules,
    parsedReactNativeConfig,
  );
  await removeForceUnlinkForNativePackage(
    'react-native-push-notification',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} Klaviyo integration complete`);
}

async function removeKlaviyo(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  removeFromStringsXML(stringsObj, 'klaviyo_company_id');
  deleteService(androidManifest, 'com.klaviyo.pushFcm.KlaviyoPushService');
  addForceUnlinkForNativePackage(
    'klaviyo-react-native-sdk',
    extraModules,
    parsedReactNativeConfig,
  );
  await addForceUnlinkForNativePackage(
    'react-native-push-notification',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addZego(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const LOG_PREFIX = '[ZEGO][ANDROID]'
  // Add permissions for live streaming (matching old script)
  addPermission(androidManifest, 'ACCESS_WIFI_STATE');
  addPermission(androidManifest, 'RECORD_AUDIO');
  addPermission(androidManifest, 'MODIFY_AUDIO_SETTINGS');
  addPermission(androidManifest, 'BLUETOOTH');
  addPermission(androidManifest, 'WRITE_EXTERNAL_STORAGE');
  addPermission(androidManifest, 'READ_PHONE_STATE');
  addPermission(androidManifest, 'WAKE_LOCK');

  // Add OpenGL ES 2.0 feature for video rendering (example usage)
  addFeature(androidManifest, {
    'android:glEsVersion': '0x00020000',
    'android:required': 'true',
  });

  // Add ENABLE_LIVELY_PIP string when both flags are true
  const enableLivelyPIP = apptileConfig.feature_flags?.ENABLE_LIVELY_PIP;
  logFeature('LivelyPIP', enableLivelyPIP);

  if (enableLivelyPIP) {
    upsertInStringsXML(stringsObj, 'ENABLE_LIVELY_PIP', 'true');
  } else {
    removeFromStringsXML(stringsObj, 'ENABLE_LIVELY_PIP');
  }

  // For Android: Always use node_modules version (no custom PIP code in Android Zego package)
  // The Android PIP implementation is in app-level code (PIPModule.kt, PIPActivity.kt)
  // not in the Zego package itself
  await removeForceUnlinkForNativePackage(
    'zego-express-engine-reactnative',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} Zego integration complete`);
}

async function removeZego(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  // Remove permissions
  deletePermission(androidManifest, 'ACCESS_WIFI_STATE');
  deletePermission(androidManifest, 'RECORD_AUDIO');
  deletePermission(androidManifest, 'MODIFY_AUDIO_SETTINGS');
  deletePermission(androidManifest, 'BLUETOOTH');
  deletePermission(androidManifest, 'WRITE_EXTERNAL_STORAGE');
  deletePermission(androidManifest, 'READ_PHONE_STATE');
  deletePermission(androidManifest, 'WAKE_LOCK');

  // Remove OpenGL ES 2.0 feature
  deleteFeature(androidManifest, {
    'android:glEsVersion': '0x00020000',
    'android:required': 'true',
  });

  // Remove ENABLE_LIVELY_PIP string
  removeFromStringsXML(stringsObj, 'ENABLE_LIVELY_PIP');

  // Always force unlink when removing zego (regardless of PIP setting)
  await addForceUnlinkForNativePackage(
    'zego-express-engine-reactnative',
    extraModules,
    parsedReactNativeConfig,
  );
}

function logFeature(feature, enabled) {
  if (enabled) {
    console.log(chalk.green(`[FeatureFlag] ${feature} → ENABLED`));
    return;
  } else {
    console.log(
      `[FeatureFlag] ${feature} → DISABLED`,
    );
  }
}

async function main() {
  const analyticsTemplateRef = {current: analyticsTemplate};
  // Get location of ios folder in project
  const androidFolderLocation = path.resolve(__dirname, 'android');

  // Read apptile.config.json
  console.log(
    'Pulling in configurations from apptile.config.json to Info.plist',
  );
  const apptileConfigRaw = await readFile(
    path.resolve(androidFolderLocation, '../apptile.config.json'),
    {encoding: 'utf8'},
  );
  const apptileConfig = JSON.parse(apptileConfigRaw);
  console.log(apptileConfig, 'config');
  console.log('Running android project setup....');
  try {
    const success = await downloadIconAndSplash(apptileConfig);
    if (success) {
      await generateIconSet(
        path.resolve(__dirname, 'scripts/android/iconset-generator.sh'),
      );
    }
  } catch (err) {
    console.error(chalk.red('could not download icon and splash'));
  }
  const extraModules = getExtraModules(apptileConfig);

  // Add strings.xml updates
  const parser = new xml2js.Parser();
  const builder = new xml2js.Builder({headless: true});

  const valuesXmlPath = path.resolve(
    androidFolderLocation,
    'app/src/main/res/values/strings.xml',
  );
  const rawStrings = await readFile(valuesXmlPath, {encoding: 'utf8'});
  const stringsObj = await parser.parseStringPromise(rawStrings);

  const androidManifestPath = path.resolve(
    androidFolderLocation,
    'app/src/main/AndroidManifest.xml',
  );
  const rawManifest = await readFile(androidManifestPath, {encoding: 'utf8'});
  const androidManifest = await parser.parseStringPromise(rawManifest);

  upsertInStringsXML(stringsObj, 'app_name', apptileConfig.app_name);
  upsertInStringsXML(
    stringsObj,
    'APPTILE_API_ENDPOINT',
    apptileConfig.APPTILE_BACKEND_URL,
  );
  upsertInStringsXML(stringsObj, 'APP_ID', apptileConfig.APP_ID);
  upsertInStringsXML(
    stringsObj,
    'APPTILE_UPDATE_ENDPOINT',
    apptileConfig.APPCONFIG_SERVER_URL,
  );

  // Update app hosts
  if (apptileConfig.app_host) {
    upsertInStringsXML(
      stringsObj,
      'APPTILE_APP_HOST',
      `https://${apptileConfig.app_host}`,
    );
  }

  if (apptileConfig.app_host_2) {
    upsertInStringsXML(
      stringsObj,
      'APPTILE_APP_HOST_2',
      `https://${apptileConfig.app_host_2}`,
    );
  }

  // Update URL scheme
  if (apptileConfig.url_scheme) {
    // Update strings.xml with URL scheme
    upsertInStringsXML(
      stringsObj,
      'APPTILE_URL_SCHEME',
      `${apptileConfig.url_scheme}://`,
    );

    // Update AndroidManifest.xml with URL scheme
    addDeeplinkScheme(androidManifest, apptileConfig.url_scheme);
  } else {
    // If no URL scheme, set empty string in strings.xml
    upsertInStringsXML(stringsObj, 'APPTILE_URL_SCHEME', '');

    // Remove deeplink scheme from AndroidManifest.xml
    deleteAndroidScheme(androidManifest);
  }

  // Add GIF_SPLASH_DURATION from feature_flags
  const gifSplashDuration = apptileConfig.feature_flags?.GIF_SPLASH_DURATION || 4;
  upsertInStringsXML(stringsObj, 'GIF_SPLASH_DURATION', String(gifSplashDuration));

  // Handle HTTP deep links for app_host and app_host_2
  if (apptileConfig.app_host || apptileConfig.app_host_2) {
    const hosts = [];
    if (apptileConfig.app_host) {
      hosts.push(apptileConfig.app_host);
    }
    if (apptileConfig.app_host_2) {
      hosts.push(apptileConfig.app_host_2);
    }
    // Add HTTP/HTTPS deep links for the hosts
    // If INTENT_FILTERS is true, use separate intent-filters for /, /products/, /collections/
    // Otherwise, use single intent-filter for all URLs
    const useIntentFilters =
      apptileConfig.feature_flags?.INTENT_FILTERS === true;
    addHttpDeepLinks(androidManifest, hosts, useIntentFilters);
  } else {
    // Remove HTTP deep links if no hosts are configured
    deleteHttpDeepLinks(androidManifest);
  }

  const parsedReactNativeConfig = await readReactNativeConfigJs();

  const isCleverTapEnabled = apptileConfig.feature_flags?.ENABLE_CLEVERTAP;
  logFeature('CleverTap', isCleverTapEnabled);

  if (isCleverTapEnabled) {
    await addCleverTap(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    await removeCleverTap(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  const isFacebookEnabled = apptileConfig.feature_flags?.ENABLE_FBSDK;
  logFeature('Facebook/MetaAds', isFacebookEnabled);

  if (isFacebookEnabled) {
    await addFacebook(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    await removeFacebook(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  const isOneSignalEnabled = apptileConfig.feature_flags?.ENABLE_ONESIGNAL;
  logFeature('OneSignal', isOneSignalEnabled);

  if (isOneSignalEnabled) {
    await addOnesignal(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    await removeOnesignal(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  const isMoengageEnabled = apptileConfig.feature_flags?.ENABLE_MOENGAGE;
  logFeature('MoEngage', isMoengageEnabled);

  if (isMoengageEnabled) {
    await addMoengage(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    await removeMoengage(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  const isKlaviyoEnabled = apptileConfig.feature_flags?.ENABLE_KLAVIYO;
  logFeature('Klaviyo', isKlaviyoEnabled);

  if (isKlaviyoEnabled) {
    await addKlaviyo(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    await removeKlaviyo(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  const isLivelyEnabled = apptileConfig.feature_flags?.ENABLE_LIVELY;
  logFeature('Lively', isLivelyEnabled);

  if (isLivelyEnabled) {
    await addZego(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    await removeZego(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  const isLogRocketEnabled = apptileConfig.feature_flags?.ENABLE_LOGROCKET;
  logFeature('LogRocket', isLogRocketEnabled);

  if (isLogRocketEnabled) {
    await addLogrocket(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    await removeLogrocket(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  const isSegmentEnabled =
    apptileConfig.feature_flags?.ENABLE_SEGMENT_ANALYTICS;
  logFeature('Segment', isSegmentEnabled);

  const SEGMENT_LOG_PREFIX = '[Segment][Android]';
  if (isSegmentEnabled) {
    console.log(`${SEGMENT_LOG_PREFIX} Initializing Segment Analytics integration`);
    if (
      apptileConfig.apptile_analytics_segment_key ||
      process.env.apptile_analytics_segment_key
    ) {
      const segment_analyticsKey =
        apptileConfig.apptile_analytics_segment_key ||
        process.env.apptile_analytics_segment_key;
      upsertInStringsXML(
        stringsObj,
        'APPTILE_ANALYTICS_SEGMENT_KEY',
        segment_analyticsKey,
      );
    } else {
      console.log(chalk.red(`${SEGMENT_LOG_PREFIX} Segment is enabled but its key is missing`));
      throw new Error('apptile_analytics_segment_key is not found in apptileConfig');
    }
  } else {
    removeFromStringsXML(stringsObj, 'APPTILE_ANALYTICS_SEGMENT_KEY');
  }
  const strObj = JSON.parse(JSON.stringify(stringsObj));

  const updatedValuesXml = builder.buildObject(strObj);
  await writeFile(valuesXmlPath, updatedValuesXml);
  const updatedAndroidManifest = builder.buildObject(androidManifest);
  await writeFile(androidManifestPath, updatedAndroidManifest);

  const bundleTrackerPath = path.resolve(
    __dirname,
    'android/app/src/main/assets/localBundleTracker.json',
  );

  // Get the manifest to identify latest appconfig, then write appConfig.json and localBundleTracker.json
  try {
    const manifestUrl = `${apptileConfig.APPTILE_BACKEND_URL}/api/v2/app/${apptileConfig.APP_ID}/manifest`;
    console.log('Downloading manifest from ' + manifestUrl);
    const {data: manifest} = await axios.get(manifestUrl);
    const publishedCommit = manifest.forks.filter(
      it => it.forkName === (apptileConfig.fork_name || 'main'),
    )[0].publishedCommitId;
    const androidBundle = manifest.codeArtefacts.find(
      it => it.type === 'android-bundle',
    );

    if (publishedCommit) {
      const appConfigUrl = `${apptileConfig.APPCONFIG_SERVER_URL}/${
        apptileConfig.APP_ID
      }/${apptileConfig.fork_name || 'main'}/main/${publishedCommit}.json`;
      console.log('Downloading appConfig from: ' + appConfigUrl);
      const assetsDir = path.resolve(__dirname, 'android/app/src/main/assets');
      await mkdir(assetsDir, {recursive: true});
      const appConfigPath = path.resolve(assetsDir, 'appConfig.json');
      console.log('Writing appConfig to: ' + appConfigPath);
      await downloadFile(appConfigUrl, appConfigPath);
      console.log(chalk.green('APPCONFIG DOWNLOADED'));

      await writeFile(
        bundleTrackerPath,
        `{"publishedCommitId": ${publishedCommit}, "androidBundleId": ${
          androidBundle?.id ?? 'null'
        }}`,
      );
    } else {
      console.error('Published appconfig not found!');
      await writeFile(
        bundleTrackerPath,
        `{"publishedCommitId": null, "androidBundleId": null}`,
      );
    }
  } catch (err) {
    console.error('Failed to download appconfig');
    await writeFile(
      bundleTrackerPath,
      `{"publishedCommitId": null, "androidBundleId": null}`,
    );
  }
  await generateAnalytics(
    analyticsTemplateRef,
    apptileConfig.integrations,
    apptileConfig.feature_flags,
  );
  await writeReactNativeConfigJs(parsedReactNativeConfig);
  await writeFile(
    path.resolve(__dirname, 'extra_modules.json'),
    JSON.stringify(extraModules.current, null, 2),
  );
  console.log(extraModules.current, 'this is the extra_modules.json');
  console.log(
    JSON.stringify(parsedReactNativeConfig),
    'thiis is the react-native.config.js',
  );
  // Update google-services.json
  const googleServicesPath = path.resolve(
    __dirname,
    'android',
    'app',
    'google-services.json',
  );
  let downloadedGoogleServices = false;
  for (let i = 0; i < apptileConfig.assets.length; ++i) {
    try {
      const asset = apptileConfig.assets[i];
      if (asset.assetClass === 'androidFirebaseServiceFile') {
        await downloadFile(asset.url, googleServicesPath);
        downloadedGoogleServices = true;
        break;
      }
    } catch (err) {
      console.error('failed to download google-services.json');
    }
  }

  if (!downloadedGoogleServices) {
    console.log(
      chalk.red(
        'Failed to download google-services.json. Will try to use the template',
      ),
    );
    const gsRaw = await readFile(googleServicesPath, {encoding: 'utf8'});
    const gsParsed = JSON.parse(gsRaw);
    gsParsed.client[0].client_info.android_client_info.package_name =
      apptileConfig.android?.bundle_id;
    await writeFile(googleServicesPath, JSON.stringify(gsParsed, null, 2));
  }

  // Download Android signing keystore
  const LOG_PREFIX_SIGNING = '[Signing][Android]';
  const keystorePath = path.resolve(__dirname, 'android', 'app', 'release.keystore');
  for (let i = 0; i < apptileConfig.assets.length; ++i) {
    try {
      const asset = apptileConfig.assets[i];
      if (asset.assetClass === 'androidStoreFile') {
        console.log(`${LOG_PREFIX_SIGNING} Downloading keystore file...`);
        await downloadFile(asset.url, keystorePath);
        console.log(chalk.green(`${LOG_PREFIX_SIGNING} Keystore downloaded to ${keystorePath}`));
        break;
      }
    } catch (err) {
      console.error(chalk.red(`${LOG_PREFIX_SIGNING} Failed to download keystore: ${err.message}`));
    }
  }
}

main();

/*
 * Usage examples
  const mainActivity = getMainActivity(manifest);
  // check intents
  addIntent(mainActivity,
    "VIEW",
    {'android:autoVerify': true},
    ["BROWSABLE", "DEFAULT"], ["http", "https"]);

  deleteIntentByScheme(mainActivity, ["http", "https"]);

  addIntent(mainActivity,
    "VIEW",
    {'android:autoVerify': true},
    ["BROWSABLE", "DEFAULT"], ["http", "https"]);

  // check permissions
  addPermission(manifest, 'CAMERA');
  deletePermission(manifest, 'CAMERA');

  // check features
  addFeature(manifest, {'android:glEsVersion': '0x00020000', 'android:required': 'true'});
  addFeature(manifest, {'android:name': 'android.hardware.camera', 'android:required': 'true'});
  deleteFeature(manifest, {'android:glEsVersion': '0x00020000', 'android:required': 'true'});

  // check service
  addService(manifest, ".MyFirebaseMessagingService", {'android:exported': true}, {
    'intent-filter': [
      {
        action: [
          {
            $: {'android:name': 'com.google.firebase.MESSAGING_EVENT'}
          }
        ]
      }
    ]
  });
  deleteService(manifest, ".MyFirebaseMessagingService");

  // check metadata
  addMetadata(manifest, 'abcd', '1234');
  deleteMetadata(manifest, 'abcd');
module.exports = {
  addDeeplinkScheme,
  deleteAndroidScheme,
  addHttpDeepLinks,
  deleteHttpDeepLinks,
  addPermission,
  deletePermission,
  addFeature,
  deleteFeature,
  addService,
  deleteService,
  addMetadata,
  deleteMetadata,
  getMainActivity,
  addIntent,
  deleteIntentByScheme,
  deleteIntentByCategory
};

 */
