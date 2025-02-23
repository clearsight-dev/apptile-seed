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
  downloadIconAndSplash
} = require('./commonProjectSetup');

const exec = util.promisify(exec_);

async function generateIconSet(scriptPath) {
  await exec(
    `${scriptPath} ${path.resolve(__dirname, 'assets', 'icon.png')} ./android/app/src/main`, 
    {cwd: path.resolve(__dirname)}
  );
}

function upsertInStringsXML(parsedXMLDoc, key, value) {
  let existingEntry = parsedXMLDoc.resources.string.find(it => it.$.name === key);
  if (!existingEntry) {
    parsedXMLDoc.resources.string.push({
      _: value, 
      $: {
        name: key
      }
    });
  } else {
    existingEntry._ = value;
  }
}

function removeFromStringsXML(parsedXMLDoc, key) {
  let existingEntryIndex = parsedXMLDoc.resources.string.findIndex(it => it.$.name === key);
  if (existingEntryIndex >= 0) {
    parsedXMLDoc.resources.string.splice(existingEntryIndex, 1);
  }
}

function getMainActivity(androidManifest) {
  const activities = androidManifest.manifest.application[0].activity;
  let mainActivity = null;
  for (let i = 0; i < activities.length; ++i) {
    const activity = activities[i];
    if (activity.$['android:name'] === '.MainActivity') {
      mainActivity = activity;
      break;
    }
  }
  return mainActivity;
}

function getMainActivity(manifest) {
  const application = manifest.manifest.application[0];
  return application.activity.find(it => {
    return it.$['android:name'] === '.MainActivity';
  });
}

function addIntent(activity, actionName, attributes, categories, schemes) {
  activity['intent-filter'] = activity['intent-filter'] || [];
  activity['intent-filter'].push({
    $: attributes,
    action: [
      {$: { 'android:name': 'android.intent.action.' + actionName }}
    ],
    category: categories.map(category => {
      return {$: { 'android:name': 'android.intent.category.' + category }};
    }),
    data: schemes.map(scheme => {
      return {$: {'android:scheme': scheme}};
    })
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
          const scheme = intent.data[i].$['android:scheme']
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
        const categoryName = intent.category[i].$['android:name']
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
          $: {'android:name': 'android.intent.action.VIEW'}
        }
      ],
      category: [
        {
          $: {'android:name': 'android.intent.category.DEFAULT'}
        },
        {
          $: {'android:name': 'android.intent.category.BROWSABLE'}
        }
      ],
      data: [
        { 
          $: {'android:scheme': urlScheme}
        }
      ]
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

function addHttpDeepLinks(androidManifest, hosts) {
  const mainActivity = getMainActivity(androidManifest);
  if (!mainActivity['intent-filter']) {
    mainActivity['intent-filter'] = [];
  }
  let existingIntent = mainActivity['intent-filter'].find(intent => {
    const schemes = intent.data.reduce((schemes, data) => {
      schemes[data.$['android:scheme']] = 1;
      return schemes;
    }, {});
    return schemes.http && schemes.https;
  });

  /* <data android:host="host1"/>
   * <data android:host="host2"/>
   */
  const hostDataNodes = hosts.map(host => {
    return { $: { 'android:host': host } };
  });
  
  /* <data android:scheme="https"/>
   * <data android:scheme="http"/>
   * <data android:host="host1"/>
   * <data android:host="host2"/>
   */
  const deepLinkData = [
    {
      $: { 'android:scheme': 'https'}
    },
    {
      $: { 'android:scheme': 'http'}
    },
    ...hostDataNodes
  ];

  if (existingIntent) {
    existingIntent.data = deepLinkData;
  } else {
    /*
     * <intent-filter android:autoVerify="true">
     *   <action android:name="android.intent.action.VIEW"/>
     *   <category android:name="android.intent.category.DEFAULT/>
     *   <category android:name="android.intent.category.BROWSABLE/>
     *   <data...
     * </intent-filter>
     * */
    mainActivity['intent-filter'].push({
      $: {
        'android:autoVerify': true
      },
      action: [
        {
          $: { 'android:name': 'android.intent.action.VIEW' }
        }
      ],
      category: [
        {
          $: { 'android:name': 'android.intent.category.DEFAULT' }
        },
        {
          $: { 'android:name': 'android.intent.category.BROWSABLE' }
        }
      ],
      data: deepLinkData
    });
  }
}

function deleteHttpDeepLinks(androidManifest) {
  const mainActivity = getMainActivity(androidManifest);
  if (!mainActivity['intent-filter']) {
    mainActivity['intent-filter'] = [];
  }
  let existingIntentIndex = mainActivity['intent-filter'].findIndex(intent => {
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
  androidManifest.manifest['uses-permission'] = androidManifest.manifest['uses-permission'] || [];
  const existingPermission  = androidManifest.manifest['uses-permission'].find(permission => {
    return permission.$['android:name'] === `android.permission.${permissionName}`;
  });
  if (!existingPermission) {
    androidManifest.manifest['uses-permission'].push({
      $: { 'android:name': `android.permission.${permissionName}` }
    });
  }
}

function deletePermission(androidManifest, permissionName) {
  androidManifest.manifest['uses-permission'] = androidManifest.manifest['uses-permission'] || [];
  const existingIndex  = androidManifest.manifest['uses-permission'].findIndex(permission => {
    return permission.$['android:name'] === `android.permission.${permissionName}`;
  });
  if (existingIndex >= 0) {
    androidManifest.manifest['uses-permission'].splice(existingIndex, 1);
  }
}

function addMetadata(androidManifest, androidName, androidValue) {
  androidManifest.manifest.application[0]['meta-data'] = androidManifest.manifest.application[0]['meta-data'] || [];
  const metaDataNodes = androidManifest.manifest.application[0]['meta-data'];
  const existingNode = metaDataNodes.find(node => node.$['android:name'] === androidName);
  if (existingNode) {
    existingNode.$['android:value'] = androidValue;
  } else {
    metaDataNodes.push({
      $: {
        'android:name': androidName,
        'android:value': androidValue
      }
    });
  }
}

function deleteMetadata(androidManifest, androidName) {
  const metaDataNodes = androidManifest.manifest.application[0]['meta-data'];
  if (metaDataNodes) {
    const index = metaDataNodes.findIndex(it => it.$['android:name'] === androidName);
    if (index >= 0) {
      metaDataNodes.splice(index, 1);
    }
  }
}

function addService(androidManifest, serviceName, attributes, children) {
  androidManifest.manifest.application[0].service = androidManifest.manifest.application[0].service || [];
  let existingService = androidManifest.manifest.application[0].service.find(it => {
    return it.$['android:name'] === serviceName;
  });
  if (existingService) {
    for (let key in existingService) {
      delete existingService[key]
    }
  } else {
    existingService = {};
    androidManifest.manifest.application[0].service.push(existingService);
  }

  existingService.$ = {
    'android:name': serviceName,
    ...attributes
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
    const index = services.findIndex(service => service.$['android:name'] === serviceName);
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
        return action.$['android:name'] === 'com.google.firebase.MESSAGING_EVENT';
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
          $: {'android:name': 'com.google.firebase.MESSAGING_EVENT'}
        }
      ]
    }
  ] 
};

async function addCleverTap(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig) {
  const cleverTapIntegration = apptileConfig.integrations.cleverTap;
  addMetadata(androidManifest, 'CLEVERTAP_ACCOUNT_ID', cleverTapIntegration.cleverTap_id);
  addMetadata(androidManifest, 'CLEVERTAP_TOKEN', cleverTapIntegration.cleverTap_token);
  addMetadata(androidManifest, 'CLEVERTAP_REGION', cleverTapIntegration.cleverTap_region);
  deleteMessagingService(androidManifest);
  addService(androidManifest, 
    "com.clevertap.android.sdk.pushnotification.fcm.FcmMessageListenerService", 
    {'android:exported': true}, 
    firebaseMessagingEventIntent
  );
  addPermission(androidManifest, 'ACCESS_NETWORK_STATE');
  await removeForceUnlinkForNativePackage('clevertap-react-native', extraModules, parsedReactNativeConfig);
}

async function removeCleverTap(androidManifest, stringsObj, extraModules, parsedReactNativeConfig) {
  deleteMetadata(androidManifest, 'CLEVERTAP_ACCOUNT_ID');
  deleteMetadata(androidManifest, 'CLEVERTAP_TOKEN');
  deleteMetadata(androidManifest, 'CLEVERTAP_REGION');
  deleteService(androidManifest, "com.clevertap.android.sdk.pushnotification.fcm.FcmMessageListenerService");
  deletePermission(androidManifest, 'ACCESS_NETWORK_STATE');
  await addForceUnlinkForNativePackage('clevertap-native-moengage', extraModules, parsedReactNativeConfig);
}

async function addFacebook(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig) {
  const facebookIntegration = apptileConfig.integrations.metaAds;
  upsertInStringsXML(stringsObj, 'facebook_app_id', facebookIntegration.FacebookAppID);
  addMetadata(androidManifest, 'com.facebook.sdk.ApplicationId', '@string/facebook_app_id');

  upsertInStringsXML(stringsObj, 'facebook_client_token', facebookIntegration.FacebookClientToken);
  addMetadata(androidManifest, 'com.facebook.sdk.ClientToken', '@string/facebook_client_token');

  await removeForceUnlinkForNativePackage('react-native-fbsdk-next', extraModules, parsedReactNativeConfig);
}

async function removeFacebook(androidManifest, stringsObj, extraModules, parsedReactNativeConfig) {
  removeFromStringsXML(stringsObj, 'facebook_app_id');
  deleteMetadata(androidManifest, 'com.facebook.sdk.ApplicationId');

  removeFromStringsXML(stringsObj, 'facebook_client_token');
  deleteMetadata(androidManifest, 'com.facebook.sdk.ClientToken');

  await addForceUnlinkForNativePackage('react-native-fbsdk-next', extraModules, parsedReactNativeConfig);
}

async function addOnesignal(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig) {
  const onesignalIntegration = apptileConfig.integrations.oneSignal;
  upsertInStringsXML(stringsObj, 'ONESIGNAL_APPID', onesignalIntegration.onesignal_app_id);
  await removeForceUnlinkForNativePackage('react-native-onesignal', extraModules, parsedReactNativeConfig);
}

async function removeOnesignal(androidManifest, stringsObj, extraModules, parsedReactNativeConfig) {
  removeFromStringsXML(stringsObj, 'ONESIGNAL_APPID');
  await addForceUnlinkForNativePackage('react-native-onesignal', extraModules, parsedReactNativeConfig);
}

async function addMoengage(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig) {
  const moengageIntegration = apptileConfig.integrations.moengage;
  upsertInStringsXML(stringsObj, 'moengage_app_id', moengageIntegration.appId);
  upsertInStringsXML(stringsObj, 'moengage_datacenter', moengageIntegration.datacenter);
  deleteMessagingService(androidManifest);
  addService(androidManifest, 
    "com.moengage.firebase.MoEFireBaseMessagingService", 
    {'android:exported': true}, 
    firebaseMessagingEventIntent
  );
  addPermission(androidManifest, 'SCHEDULE_EXACT_ALARM');
  await removeForceUnlinkForNativePackage('react-native-moengage', extraModules, parsedReactNativeConfig);
}

async function removeMoengage(androidManifest, stringsObj, extraModules, parsedReactNativeConfig) {
  removeFromStringsXML(stringsObj, 'moengage_app_id');
  removeFromStringsXML(stringsObj, 'moengage_datacenter');
  deleteService(androidManifest, "com.moengage.firebase.MoEFireBaseMessagingService");
  deletePermission(androidManifest, 'SCHEDULE_EXACT_ALARM');
  await addForceUnlinkForNativePackage('react-native-moengage', extraModules, parsedReactNativeConfig);
}

async function addKlaviyo(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig) {
  const klaviyoCompanyId = apptileConfig.integrations.klaviyo_company_id;
  upsertInStringsXML(stringsObj, 'klaviyo_company_id', klaviyoCompanyId);
  addService(androidManifest, "com.klaviyo.pushFcm.KlaviyoPushService", { 'android:exported': false }, firebaseMessagingEventIntent);
  removeForceUnlinkForNativePackage('react-native-klaviyo', extraModules, parsedReactNativeConfig);
  await removeForceUnlinkForNativePackage('react-native-push-notification', extraModules, parsedReactNativeConfig);
}

async function removeKlaviyo(androidManifest, stringsObj, extraModules, parsedReactNativeConfig) {
  removeFromStringsXML(stringsObj, 'klaviyo_company_id');
  deleteService(androidManifest, "com.klaviyo.pushFcm.KlaviyoPushService");
  addForceUnlinkForNativePackage('react-native-klaviyo', extraModules, parsedReactNativeConfig);
  await addForceUnlinkForNativePackage('react-native-push-notification', extraModules, parsedReactNativeConfig);
}

async function main() {
  const analyticsTemplateRef = {current: analyticsTemplate};
  // Get location of ios folder in project
  const androidFolderLocation = path.resolve(__dirname, 'android');

  // Read apptile.config.json
  console.log("Pulling in configurations from apptile.config.json to Info.plist");
  const apptileConfigRaw = await readFile(
    path.resolve(androidFolderLocation, '../apptile.config.json'), 
    {encoding: 'utf8'}
  );
  const apptileConfig = JSON.parse(apptileConfigRaw);
  try {
    const success = await downloadIconAndSplash(apptileConfig);
    if (success) {
      await generateIconSet(path.resolve(apptileConfig.SDK_PATH, 'packages/apptile-app/devops/scripts/android/iconset-generator.sh'));
    }
  } catch(err) {
    console.error(chalk.red('could not download icon and splash'));
  }
  const extraModules = getExtraModules(apptileConfig);

  // Add strings.xml updates
  const parser = new xml2js.Parser();
  const builder = new xml2js.Builder({headless: true});

  const valuesXmlPath = path.resolve(androidFolderLocation, 'app/src/main/res/values/strings.xml');
  const rawStrings = await readFile(valuesXmlPath, {encoding: 'utf8'});
  const stringsObj = await parser.parseStringPromise(rawStrings);

  const androidManifestPath = path.resolve(androidFolderLocation, 'app/src/main/AndroidManifest.xml');
  const rawManifest = await readFile(androidManifestPath, {encoding: 'utf8'});
  const androidManifest = await parser.parseStringPromise(rawManifest);

  upsertInStringsXML(stringsObj, 'app_name', apptileConfig.app_name);
  upsertInStringsXML(stringsObj, 'APPTILE_API_ENDPOINT', apptileConfig.APPTILE_BACKEND_URL);
  upsertInStringsXML(stringsObj, 'APP_ID', apptileConfig.APP_ID);
  upsertInStringsXML(stringsObj, 'APPTILE_UPDATE_ENDPOINT', apptileConfig.APPCONFIG_SERVER_URL);

  const parsedReactNativeConfig = await readReactNativeConfigJs();

  if (apptileConfig.feature_flags.ENABLE_CLEVERTAP) {
    await addCleverTap(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig)
  } else {
    await removeCleverTap(androidManifest, stringsObj, extraModules, parsedReactNativeConfig); 
  }
  if (apptileConfig.feature_flags.ENABLE_FBSDK) {
    await addFacebook(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig)
  } else {
    await removeFacebook(androidManifest, stringsObj, extraModules, parsedReactNativeConfig); 
  }

  if (apptileConfig.feature_flags.ENABLE_ONESIGNAL) {
    await addOnesignal(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig)
  } else {
    await removeOnesignal(androidManifest, stringsObj, extraModules, parsedReactNativeConfig); 
  }

  if (apptileConfig.feature_flags.ENABLE_MOENGAGE) {
    await addMoengage(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig)
  } else {
    await removeMoengage(androidManifest, stringsObj, extraModules, parsedReactNativeConfig);
  }

  if (apptileConfig.feature_flags.ENABLE_KLAVIYO) {
    await addKlaviyo(androidManifest, stringsObj, apptileConfig, extraModules, parsedReactNativeConfig);
  }
  else {
    await removeKlaviyo(androidManifest, stringsObj, extraModules, parsedReactNativeConfig);
  }

  const updatedValuesXml = builder.buildObject(stringsObj);
  await writeFile(valuesXmlPath, updatedValuesXml);
  const updatedAndroidManifest = builder.buildObject(androidManifest);
  await writeFile(androidManifestPath, updatedAndroidManifest);


  // Get the manifest to identify latest appconfig, then write appConfig.json and localBundleTracker.json 
  const manifestUrl = `${apptileConfig.APPTILE_BACKEND_URL}/api/v2/app/${apptileConfig.APP_ID}/manifest`;
  console.log('Downloading manifest from ' + manifestUrl);
  const {data: manifest} = await axios.get(manifestUrl);
  // console.log('manifest: ', manifest);
  const publishedCommit = manifest.forks[0].publishedCommitId;
  const androidBundle = manifest.codeArtefacts.find((it) => it.type === 'android-bundle');

  const appConfigUrl = `${apptileConfig.APPCONFIG_SERVER_URL}/${apptileConfig.APP_ID}/main/main/${publishedCommit}.json`;
  console.log('Downloading appConfig from: ' + appConfigUrl);
  if (publishedCommit) {
    const assetsDir = path.resolve(__dirname, 'android/app/src/main/assets');
    await mkdir(assetsDir, {recursive: true});
    const appConfigPath = path.resolve(assetsDir, 'appConfig.json');
    await downloadFile(appConfigUrl, appConfigPath);
    console.log('appConfig downloaded');
    const bundleTrackerPath = path.resolve(__dirname, 'android/app/src/main/assets/localBundleTracker.json');
    await writeFile(bundleTrackerPath, `{"publishedCommitId": ${publishedCommit}, "androidBundleId": ${androidBundle?.id ?? "null"}}`)
  } else {
    console.error("Published appconfig not found! Stopping build.")
    process.exit(1);
  }
  console.log("Running android project setup");
  await generateAnalytics(analyticsTemplateRef, apptileConfig.integrations, apptileConfig.feature_flags);
  await writeReactNativeConfigJs(parsedReactNativeConfig);
  await writeFile(path.resolve(__dirname, 'extra_modules.json'), JSON.stringify(extraModules.current, null, 2));

  // Update google-services.json
  const googleServicesPath = path.resolve(__dirname, 'android', 'app', 'google-services.json');
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
      console.error("failed to download google-services.json");
    }
  }

  if (!downloadedGoogleServices) {
    console.log(chalk.red('Failed to download google-services.json. Will try to use the template'));
    const gsRaw = await readFile(googleServicesPath, {encoding: 'utf8'});
    const gsParsed = JSON.parse(gsRaw);
    gsParsed.client[0].client_info.android_client_info.package_name = apptileConfig.android.bundle_id;
    await writeFile(googleServicesPath, JSON.stringify(gsParsed, null, 2));
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
