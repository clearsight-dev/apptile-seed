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

console.log('========== ANDROID PROJECT SETUP STARTED ==========');

const chalk = require('chalk');
const xml2js = require('xml2js');
const path = require('path');
const os = require('os');
const axios = require('axios');
const util = require('util');
const {exec: exec_} = require('child_process');
const {readFile, writeFile, mkdir} = require('node:fs/promises');

// Log node and system information
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${os.platform()} ${os.release()}`);
console.log(`Architecture: ${os.arch()}`);
console.log(`Current directory: ${process.cwd()}`);

// Helper function for consistent logging
const logDebug = message => console.log(chalk.blue(`[DEBUG] ${message}`));
const logInfo = message => console.log(chalk.green(`[INFO] ${message}`));
const logWarning = message => console.log(chalk.yellow(`[WARNING] ${message}`));
const logError = message => console.error(chalk.red(`[ERROR] ${message}`));

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

logDebug('Successfully imported functions from commonProjectSetup.js');

const exec = util.promisify(exec_);

async function generateIconSet(scriptPath) {
  logDebug(`generateIconSet() called with script path: ${scriptPath}`);
  logDebug(`Current directory: ${__dirname}`);
  logDebug(
    `Target icon path: ${path.resolve(__dirname, 'assets', 'icon.png')}`,
  );
  logDebug(`Target output directory: ./android/app/src/main`);

  try {
    const command = `${scriptPath} ${path.resolve(
      __dirname,
      'assets',
      'icon.png',
    )} ./android/app/src/main`;
    logDebug(`Executing command: ${command}`);

    const result = await exec(command, {cwd: path.resolve(__dirname)});

    logDebug(`Command stdout: ${result.stdout}`);
    if (result.stderr) logDebug(`Command stderr: ${result.stderr}`);

    logInfo('Icon set generated successfully');
  } catch (error) {
    logError(`Failed to generate icon set: ${error.message}`);
    if (error.stdout) logDebug(`Error stdout: ${error.stdout}`);
    if (error.stderr) logDebug(`Error stderr: ${error.stderr}`);
    throw error;
  }
}

function upsertInStringsXML(parsedXMLDoc, key, value) {
  logDebug(`upsertInStringsXML() called with key: ${key}, value: ${value}`);
  logDebug(
    `Current XML has ${parsedXMLDoc.resources.string.length} string entries`,
  );

  let existingEntry = parsedXMLDoc.resources.string.find(
    it => it.$.name === key,
  );

  if (!existingEntry) {
    logDebug(`- Entry with key '${key}' not found in strings.xml`);
    logDebug(`- Adding new entry for ${key}`);
    parsedXMLDoc.resources.string.push({
      _: value,
      $: {
        name: key,
      },
    });
    logDebug(
      `- New entry added, total entries now: ${parsedXMLDoc.resources.string.length}`,
    );
  } else {
    logDebug(
      `- Found existing entry for '${key}' with value: '${existingEntry._}'`,
    );
    logDebug(`- Updating existing entry to: '${value}'`);
    existingEntry._ = value;
  }
  logDebug(`upsertInStringsXML() completed for ${key}`);
}

function removeFromStringsXML(parsedXMLDoc, key) {
  logDebug(`removeFromStringsXML() called for key: ${key}`);
  logDebug(
    `Current XML has ${parsedXMLDoc.resources.string.length} string entries`,
  );

  let existingEntryIndex = parsedXMLDoc.resources.string.findIndex(
    it => it.$.name === key,
  );

  if (existingEntryIndex >= 0) {
    logDebug(`- Found entry for '${key}' at index ${existingEntryIndex}`);
    logDebug(
      `- Original value: '${parsedXMLDoc.resources.string[existingEntryIndex]._}'`,
    );
    logDebug(`- Removing entry for ${key}`);
    parsedXMLDoc.resources.string.splice(existingEntryIndex, 1);
    logDebug(
      `- Entry removed, total entries now: ${parsedXMLDoc.resources.string.length}`,
    );
  } else {
    logDebug(`- No entry found for key '${key}', nothing to remove`);
  }
  logDebug(`removeFromStringsXML() completed for ${key}`);
}

function getMainActivity(androidManifest) {
  logDebug('getMainActivity() called');
  logDebug(
    `AndroidManifest structure: ${androidManifest ? 'valid' : 'invalid'}`,
  );

  if (
    !androidManifest ||
    !androidManifest.manifest ||
    !androidManifest.manifest.application
  ) {
    logError(
      'Invalid AndroidManifest structure - missing manifest or application nodes',
    );
    return null;
  }

  const activities = androidManifest.manifest.application[0].activity;
  logDebug(
    `Found ${activities ? activities.length : 0} activities in manifest`,
  );

  let mainActivity = null;
  for (let i = 0; i < activities.length; ++i) {
    const activity = activities[i];
    logDebug(
      `Checking activity[${i}] with name: ${activity.$['android:name']}`,
    );
    if (activity.$['android:name'] === '.MainActivity') {
      mainActivity = activity;
      logDebug('- MainActivity found');
      break;
    }
  }

  if (!mainActivity) {
    logWarning('- MainActivity not found in AndroidManifest.xml');
  } else {
    logDebug(
      `- MainActivity has ${
        mainActivity['intent-filter'] ? mainActivity['intent-filter'].length : 0
      } intent filters`,
    );
  }

  return mainActivity;
}

function getMainActivity(manifest) {
  logDebug('getMainActivity() called (second implementation)');
  logDebug(`Manifest structure: ${manifest ? 'valid' : 'invalid'}`);

  if (!manifest || !manifest.manifest || !manifest.manifest.application) {
    logError(
      'Invalid manifest structure - missing manifest or application nodes',
    );
    return null;
  }

  const application = manifest.manifest.application[0];
  logDebug(
    `Application node found with ${
      application.activity ? application.activity.length : 0
    } activities`,
  );

  const mainActivity = application.activity.find(it => {
    logDebug(`Checking activity with name: ${it.$['android:name']}`);
    return it.$['android:name'] === '.MainActivity';
  });

  if (mainActivity) {
    logDebug('- MainActivity found');
    logDebug(
      `- MainActivity has ${
        mainActivity['intent-filter'] ? mainActivity['intent-filter'].length : 0
      } intent filters`,
    );
  } else {
    logWarning('- MainActivity not found in manifest');
  }

  return mainActivity;
}

function addIntent(activity, actionName, attributes, categories, schemes) {
  logDebug(`addIntent() called with action: ${actionName}`);
  logDebug(`- Activity: ${activity ? 'valid' : 'invalid'}`);
  logDebug(`- Attributes: ${JSON.stringify(attributes)}`);
  logDebug(`- Categories: ${JSON.stringify(categories)}`);
  logDebug(`- Schemes: ${JSON.stringify(schemes)}`);

  if (!activity) {
    logError('Invalid activity provided to addIntent');
    return;
  }

  // Initialize intent-filter array if it doesn't exist
  if (!activity['intent-filter']) {
    logDebug('- No existing intent-filters, creating new array');
    activity['intent-filter'] = [];
  } else {
    logDebug(
      `- Activity already has ${activity['intent-filter'].length} intent filters`,
    );
  }

  // Create intent filter action
  const intentAction = [
    {$: {'android:name': 'android.intent.action.' + actionName}},
  ];
  logDebug(`- Created action: ${JSON.stringify(intentAction)}`);

  // Create intent filter categories
  const intentCategories = categories.map(category => {
    logDebug(`- Creating category: ${category}`);
    return {$: {'android:name': 'android.intent.category.' + category}};
  });

  // Create intent filter data/schemes
  const intentData = schemes.map(scheme => {
    logDebug(`- Creating scheme: ${scheme}`);
    return {$: {'android:scheme': scheme}};
  });

  // Create and push the complete intent filter
  const intentFilter = {
    $: attributes,
    action: intentAction,
    category: intentCategories,
    data: intentData,
  };

  logDebug(`- Adding new intent filter: ${JSON.stringify(intentFilter)}`);
  activity['intent-filter'].push(intentFilter);
  logDebug(
    `- Activity now has ${activity['intent-filter'].length} intent filters`,
  );

  logInfo(`Intent filter with action ${actionName} added successfully`);
}

function deleteIntentByScheme(activity, requiredSchemes) {
  logDebug(
    `deleteIntentByScheme() called with schemes: ${JSON.stringify(
      requiredSchemes,
    )}`,
  );
  logDebug(`- Activity: ${activity ? 'valid' : 'invalid'}`);

  if (!activity) {
    logError('Invalid activity provided to deleteIntentByScheme');
    return;
  }

  if (activity['intent-filter']) {
    logDebug(
      `- Activity has ${activity['intent-filter'].length} intent filters to check`,
    );

    const index = activity['intent-filter'].findIndex(intent => {
      logDebug(`- Checking intent filter: ${JSON.stringify(intent.$)}`);

      const schemes = {};
      if (!intent.data) {
        logDebug('- Intent has no data/schemes, skipping');
        return false;
      } else {
        logDebug(`- Intent has ${intent.data.length} data/scheme entries`);

        for (let i = 0; i < intent.data.length; ++i) {
          const scheme = intent.data[i].$['android:scheme'];
          schemes[scheme] = 1;
          logDebug(`- Found scheme: ${scheme}`);
        }

        logDebug(
          `- Checking if all ${requiredSchemes.length} required schemes exist in this intent`,
        );
        let allRequiredSchemesExist = true;
        for (let i = 0; i < requiredSchemes.length; ++i) {
          const requiredScheme = requiredSchemes[i];
          if (!schemes[requiredScheme]) {
            logDebug(
              `- Required scheme ${requiredScheme} not found, not a match`,
            );
            allRequiredSchemesExist = false;
            break;
          } else {
            logDebug(`- Required scheme ${requiredScheme} found`);
          }
        }

        if (allRequiredSchemesExist) {
          logDebug('- All required schemes found in this intent filter');
        }

        return allRequiredSchemesExist;
      }
    });

    if (index >= 0) {
      logInfo(`Deleting intent-filter at index ${index}`);
      activity['intent-filter'].splice(index, 1);
      logDebug(
        `- Activity now has ${activity['intent-filter'].length} intent filters after deletion`,
      );
    } else {
      logDebug('No matching intent-filter found for deletion');
    }
  } else {
    logDebug('No intent-filters found in activity');
  }

  logDebug('deleteIntentByScheme() completed');
}

// will delete intent which has all mentioned categories
function deleteIntentByCategory(activity, categories) {
  logDebug(`Deleting intent by categories: ${JSON.stringify(categories)}`);

  if (activity['intent-filter']) {
    const index = activity['intent-filter'].findIndex(intent => {
      const categoryNames = {};
      for (let i = 0; i < intent.category.length; ++i) {
        const categoryName = intent.category[i].$['android:name'];
        categoryNames[categoryName] = 1;
        logDebug(`- Found category: ${categoryName}`);
      }

      let allRequiredCategoriesMatch = true;
      for (let i = 0; i < categories.length; ++i) {
        const fullCategoryName = `android.intent.category.${categories[i]}`;
        if (!categoryNames[fullCategoryName]) {
          logDebug(
            `- Required category ${fullCategoryName} not found, not a match`,
          );
          allRequiredCategoriesMatch = false;
          break;
        }
      }
      return allRequiredCategoriesMatch;
    });

    if (index >= 0) {
      logInfo(
        `Deleting intent-filter at index ${index} with matching categories`,
      );
      activity['intent-filter'].splice(index, 1);
    } else {
      logDebug('No matching intent-filter found for deletion by categories');
    }
  } else {
    logDebug('No intent-filters found in activity');
  }
}

function addDeeplinkScheme(androidManifest, urlScheme) {
  logDebug(`Adding deeplink scheme: ${urlScheme}`);
  const mainActivity = getMainActivity(androidManifest);

  const intentFilters = mainActivity['intent-filter'];
  let targetIntent = null;
  logDebug(
    `Searching through ${
      intentFilters ? intentFilters.length : 0
    } intent filters`,
  );

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

    logDebug(
      `- Intent filter ${i} actions: ${JSON.stringify(Object.keys(actions))}`,
    );
    logDebug(
      `- Intent filter ${i} categories: ${JSON.stringify(
        Object.keys(categories),
      )}`,
    );

    if (
      actions['android.intent.action.VIEW'] &&
      categories['android.intent.category.DEFAULT'] &&
      categories['android.intent.category.BROWSABLE']
    ) {
      logDebug(`- Found matching intent filter at index ${i}`);
      targetIntent = intent;
      break;
    }
  }

  if (targetIntent) {
    logInfo(`Updating existing intent filter with scheme: ${urlScheme}`);
    targetIntent.data[0].$['android:scheme'] = urlScheme;
  } else {
    logInfo(`Creating new intent filter with scheme: ${urlScheme}`);
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
  logDebug('Deleting Android scheme intent filters');
  const mainActivity = getMainActivity(androidManifest);

  if (mainActivity['intent-filter']) {
    let targetIntentIndex = -1;
    logDebug(
      `Searching through ${mainActivity['intent-filter'].length} intent filters`,
    );

    for (let i = 0; i < mainActivity['intent-filter'].length; ++i) {
      const intentFilter = mainActivity['intent-filter'][i];

      const hasViewAction = intentFilter.action.find(
        action => action.$['android:name'] === 'android.intent.action.VIEW',
      );
      const hasDefaultCategory = intentFilter.category.find(
        category =>
          category.$['android:name'] === 'android.intent.category.DEFAULT',
      );
      const hasBrowsableCategory = intentFilter.category.find(
        category =>
          category.$['android:name'] === 'android.intent.category.BROWSABLE',
      );

      logDebug(`- Intent filter ${i}:`);
      logDebug(`  - Has VIEW action: ${!!hasViewAction}`);
      logDebug(`  - Has DEFAULT category: ${!!hasDefaultCategory}`);
      logDebug(`  - Has BROWSABLE category: ${!!hasBrowsableCategory}`);

      if (hasViewAction && hasDefaultCategory && hasBrowsableCategory) {
        const hasHttpScheme = intentFilter.data.find(
          data =>
            data.$['android:scheme'] === 'http' ||
            data.$['android:scheme'] === 'https',
        );
        logDebug(`  - Has HTTP/HTTPS scheme: ${!!hasHttpScheme}`);

        if (!hasHttpScheme) {
          targetIntentIndex = i;
          logDebug(`  - Found target intent filter at index ${i}`);
          break;
        }
      }
    }

    if (targetIntentIndex >= 0) {
      logInfo(`Deleting intent filter at index ${targetIntentIndex}`);
      mainActivity['intent-filter'].splice(targetIntentIndex, 1);
    } else {
      logDebug('No suitable Android scheme intent filter found for deletion');
    }
  } else {
    logDebug('No intent filters found in MainActivity');
  }
}

function addHttpDeepLinks(androidManifest, hosts) {
  logDebug('Adding HTTP deep links');
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
    return {$: {'android:host': host}};
  });

  /* <data android:scheme="https"/>
   * <data android:scheme="http"/>
   * <data android:host="host1"/>
   * <data android:host="host2"/>
   */
  const deepLinkData = [
    {
      $: {'android:scheme': 'https'},
    },
    {
      $: {'android:scheme': 'http'},
    },
    ...hostDataNodes,
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
        'android:autoVerify': true,
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
      data: deepLinkData,
    });
  }
}

function deleteHttpDeepLinks(androidManifest) {
  logDebug('Deleting HTTP deep links');
  const mainActivity = getMainActivity(androidManifest);

  if (mainActivity['intent-filter']) {
    let targetIntentIndex = -1;
    logDebug(
      `Searching through ${mainActivity['intent-filter'].length} intent filters`,
    );

    for (let i = 0; i < mainActivity['intent-filter'].length; ++i) {
      const intentFilter = mainActivity['intent-filter'][i];

      if (intentFilter.$ && intentFilter.$['android:autoVerify'] === 'true') {
        logDebug(`- Found auto-verify intent filter at index ${i}`);
        targetIntentIndex = i;
        break;
      }
    }

    if (targetIntentIndex >= 0) {
      logInfo(
        `Deleting intent filter with auto-verify at index ${targetIntentIndex}`,
      );
      mainActivity['intent-filter'].splice(targetIntentIndex, 1);
    } else {
      logDebug('No auto-verify intent filter found for deletion');
    }
  } else {
    logDebug('No intent filters found in MainActivity');
  }
}

function addPermission(androidManifest, permissionName) {
  logDebug(`Adding permission: ${permissionName}`);
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
    logInfo(`Adding new permission: android.permission.${permissionName}`);
    androidManifest.manifest['uses-permission'].push({
      $: {
        'android:name': `android.permission.${permissionName}`,
      },
    });
  } else {
    logDebug(
      `Permission android.permission.${permissionName} already exists, skipping`,
    );
  }
}

function deletePermission(androidManifest, permissionName) {
  logDebug(`Deleting permission: ${permissionName}`);
  if (androidManifest.manifest['uses-permission']) {
    const index = androidManifest.manifest['uses-permission'].findIndex(
      permission => {
        return (
          permission.$['android:name'] ===
          `android.permission.${permissionName}`
        );
      },
    );

    if (index >= 0) {
      logInfo(`Removing permission android.permission.${permissionName}`);
      androidManifest.manifest['uses-permission'].splice(index, 1);
    } else {
      logDebug(
        `Permission android.permission.${permissionName} not found, nothing to delete`,
      );
    }
  } else {
    logDebug('No permissions found in manifest');
  }
}

function addMetadata(androidManifest, androidName, androidValue) {
  logDebug(`Adding metadata: ${androidName}=${androidValue}`);
  const application = androidManifest.manifest.application[0];
  application['meta-data'] = application['meta-data'] || [];

  let existingMetadata = application['meta-data'].find(meta => {
    return meta.$['android:name'] === androidName;
  });

  if (existingMetadata) {
    logDebug(
      `Updating existing metadata ${androidName} from ${existingMetadata.$['android:value']} to ${androidValue}`,
    );
    existingMetadata.$['android:value'] = androidValue;
  } else {
    logInfo(`Adding new metadata ${androidName}=${androidValue}`);
    application['meta-data'].push({
      $: {
        'android:name': androidName,
        'android:value': androidValue,
      },
    });
  }
}

function deleteMetadata(androidManifest, androidName) {
  logDebug(`Deleting metadata: ${androidName}`);
  const application = androidManifest.manifest.application[0];
  application['meta-data'] = application['meta-data'] || [];

  const index = application['meta-data'].findIndex(
    meta => meta.$['android:name'] === androidName,
  );
  if (index >= 0) {
    logInfo(`Removing metadata ${androidName}`);
    application['meta-data'].splice(index, 1);
  } else {
    logDebug(`Metadata ${androidName} not found, nothing to delete`);
  }
}

function addService(androidManifest, serviceName, attributes, children) {
  logDebug(`Adding service: ${serviceName}`);
  logDebug(`- Attributes: ${JSON.stringify(attributes)}`);
  logDebug(`- Children: ${JSON.stringify(children)}`);

  const application = androidManifest.manifest.application[0];
  application.service = application.service || [];
  let existingService = application.service.find(service => {
    return service.$['android:name'] === serviceName;
  });

  let serviceAttrs = {'android:name': serviceName, ...attributes};

  if (existingService) {
    logDebug(`Updating existing service ${serviceName}`);
    existingService.$ = serviceAttrs;

    for (const childProp in children) {
      logDebug(`- Adding child property: ${childProp}`);
      existingService[childProp] = children[childProp];
    }
  } else {
    logInfo(`Adding new service ${serviceName}`);
    application.service.push({
      $: serviceAttrs,
      ...children,
    });
  }
}

function deleteService(androidManifest, serviceName) {
  logDebug(`Deleting service: ${serviceName}`);
  const application = androidManifest.manifest.application[0];
  application.service = application.service || [];

  const index = application.service.findIndex(
    service => service.$['android:name'] === serviceName,
  );
  if (index >= 0) {
    logInfo(`Removing service ${serviceName}`);
    application.service.splice(index, 1);
  } else {
    logDebug(`Service ${serviceName} not found, nothing to delete`);
  }
}

// Deletes the service that has the intent
/**
 * <intent-filter>
 *  <action android:name="com.google.firebase.MESSAGING_EVENT" />
 * </intent-filter>
 */
function deleteMessagingService(androidManifest) {
  logDebug('Deleting Firebase Messaging Service');
  const application = androidManifest.manifest.application[0];
  if (application.service) {
    logDebug(`Searching through ${application.service.length} services`);
    const serviceIndex = application.service.findIndex(service => {
      if (!service['intent-filter']) {
        logDebug(
          `- Service ${service.$['android:name']} has no intent filters, skipping`,
        );
        return false;
      }

      const hasMessagingIntent = service['intent-filter'].findIndex(intent => {
        if (!intent.action) {
          logDebug('  - Intent filter has no actions, skipping');
          return false;
        }

        const hasMessagingAction = intent.action.findIndex(action => {
          return (
            action.$['android:name'] === 'com.google.firebase.MESSAGING_EVENT'
          );
        });

        if (hasMessagingAction >= 0) {
          logDebug('  - Found Firebase Messaging Event action');
        }
        return hasMessagingAction >= 0;
      });

      return hasMessagingIntent >= 0;
    });

    if (serviceIndex >= 0) {
      logInfo(`Removing Firebase Messaging Service at index ${serviceIndex}`);
      application.service.splice(serviceIndex, 1);
    } else {
      logDebug('No Firebase Messaging Service found to delete');
    }
  } else {
    logDebug('No services found in application');
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
  const cleverTapIntegration = apptileConfig.integrations.cleverTap;
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
  const facebookIntegration = apptileConfig.integrations.metaAds;
  upsertInStringsXML(
    stringsObj,
    'facebook_app_id',
    facebookIntegration.FacebookAppID,
  );
  addMetadata(
    androidManifest,
    'com.facebook.sdk.ApplicationId',
    '@string/facebook_app_id',
  );

  upsertInStringsXML(
    stringsObj,
    'facebook_client_token',
    facebookIntegration.FacebookClientToken,
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
  const onesignalIntegration = apptileConfig.integrations.oneSignal;
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

async function addMoengage(
  androidManifest,
  stringsObj,
  apptileConfig,
  extraModules,
  parsedReactNativeConfig,
) {
  const moengageIntegration = apptileConfig.integrations.moengage;
  upsertInStringsXML(stringsObj, 'moengage_app_id', moengageIntegration.appId);
  upsertInStringsXML(
    stringsObj,
    'moengage_datacenter',
    moengageIntegration.datacenter,
  );
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
  const klaviyoCompanyId = apptileConfig.integrations.klaviyo_company_id;
  upsertInStringsXML(stringsObj, 'klaviyo_company_id', klaviyoCompanyId);
  addService(
    androidManifest,
    'com.klaviyo.pushFcm.KlaviyoPushService',
    {'android:exported': false},
    firebaseMessagingEventIntent,
  );
  removeForceUnlinkForNativePackage(
    'react-native-klaviyo',
    extraModules,
    parsedReactNativeConfig,
  );
  await removeForceUnlinkForNativePackage(
    'react-native-push-notification',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeKlaviyo(
  androidManifest,
  stringsObj,
  extraModules,
  parsedReactNativeConfig,
) {
  logInfo('Removing Klaviyo configuration');
  removeFromStringsXML(stringsObj, 'klaviyo_company_id');
  deleteService(androidManifest, 'com.klaviyo.pushFcm.KlaviyoPushService');

  try {
    logDebug('Unlinking react-native-klaviyo package');
    await addForceUnlinkForNativePackage(
      'react-native-klaviyo',
      extraModules,
      parsedReactNativeConfig,
    );

    logDebug('Unlinking react-native-push-notification package');
    await addForceUnlinkForNativePackage(
      'react-native-push-notification',
      extraModules,
      parsedReactNativeConfig,
    );
    logInfo('Klaviyo packages successfully unlinked');
  } catch (error) {
    logError(`Error unlinking Klaviyo packages: ${error.message}`);
  }
}

async function main() {
  logInfo('Starting Android project setup process');
  const analyticsTemplateRef = {current: analyticsTemplate};
  // Get location of ios folder in project
  const androidFolderLocation = path.resolve(__dirname, 'android');
  logDebug(`Android folder location: ${androidFolderLocation}`);

  // Read apptile.config.json
  logInfo('Pulling in configurations from apptile.config.json');
  const apptileConfigPath = path.resolve(
    androidFolderLocation,
    '../apptile.config.json',
  );
  logDebug(`Reading config from: ${apptileConfigPath}`);
  const apptileConfigRaw = await readFile(apptileConfigPath, {
    encoding: 'utf8',
  });
  const apptileConfig = JSON.parse(apptileConfigRaw);
  logDebug(
    `Parsed apptile.config.json with app_name: ${apptileConfig.app_name}`,
  );

  try {
    logInfo('Downloading icon and splash assets');
    const success = await downloadIconAndSplash(apptileConfig);
    if (success) {
      logInfo('Successfully downloaded icon and splash');
      if (os.platform() === 'darwin') {
        const iconsetScript = path.resolve(
          apptileConfig.SDK_PATH,
          'packages/apptile-app/devops/scripts/android/iconset-generator.sh',
        );
        logDebug(`Running iconset generator script: ${iconsetScript}`);
        await generateIconSet(iconsetScript);
      } else {
        logDebug(`Skipping iconset generation on platform: ${os.platform()}`);
      }
    }
  } catch (err) {
    logError(`Could not download icon and splash: ${err.message}`);
  }

  logDebug('Getting extra modules from config');
  const extraModules = getExtraModules(apptileConfig);

  // Add strings.xml updates
  logInfo('Updating strings.xml with app configurations');
  const parser = new xml2js.Parser();
  const builder = new xml2js.Builder({headless: true});

  const valuesXmlPath = path.resolve(
    androidFolderLocation,
    'app/src/main/res/values/strings.xml',
  );
  logDebug(`Reading strings.xml from: ${valuesXmlPath}`);
  const rawStrings = await readFile(valuesXmlPath, {encoding: 'utf8'});
  const stringsObj = await parser.parseStringPromise(rawStrings);
  logDebug('Successfully parsed strings.xml');

  const androidManifestPath = path.resolve(
    androidFolderLocation,
    'app/src/main/AndroidManifest.xml',
  );
  logDebug(`Reading AndroidManifest.xml from: ${androidManifestPath}`);
  const rawManifest = await readFile(androidManifestPath, {encoding: 'utf8'});
  const androidManifest = await parser.parseStringPromise(rawManifest);
  logDebug('Successfully parsed AndroidManifest.xml');

  logDebug(`Setting app_name to: ${apptileConfig.app_name}`);
  upsertInStringsXML(stringsObj, 'app_name', apptileConfig.app_name);
  logDebug(
    `Setting APPTILE_API_ENDPOINT to: ${apptileConfig.APPTILE_BACKEND_URL}`,
  );
  upsertInStringsXML(
    stringsObj,
    'APPTILE_API_ENDPOINT',
    apptileConfig.APPTILE_BACKEND_URL,
  );
  logDebug(`Setting APP_ID to: ${apptileConfig.APP_ID}`);
  upsertInStringsXML(stringsObj, 'APP_ID', apptileConfig.APP_ID);
  logDebug(
    `Setting APPTILE_UPDATE_ENDPOINT to: ${apptileConfig.APPCONFIG_SERVER_URL}`,
  );
  upsertInStringsXML(
    stringsObj,
    'APPTILE_UPDATE_ENDPOINT',
    apptileConfig.APPCONFIG_SERVER_URL,
  );

  logInfo('Processing feature flags and integrations');
  const parsedReactNativeConfig = await readReactNativeConfigJs();
  logDebug('Successfully read React Native config');

  // CleverTap integration
  if (apptileConfig.feature_flags?.ENABLE_CLEVERTAP) {
    logInfo('CleverTap is enabled, adding configuration');
    await addCleverTap(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    logInfo('CleverTap is disabled, removing configuration');
    await removeCleverTap(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  // Facebook SDK integration
  if (apptileConfig.feature_flags?.ENABLE_FBSDK) {
    logInfo('Facebook SDK is enabled, adding configuration');
    await addFacebook(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    logInfo('Facebook SDK is disabled, removing configuration');
    await removeFacebook(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  // OneSignal integration
  if (apptileConfig.feature_flags?.ENABLE_ONESIGNAL) {
    logInfo('OneSignal is enabled, adding configuration');
    await addOnesignal(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    logInfo('OneSignal is disabled, removing configuration');
    await removeOnesignal(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  // MoEngage integration
  if (apptileConfig.feature_flags?.ENABLE_MOENGAGE) {
    logInfo('MoEngage is enabled, adding configuration');
    await addMoengage(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    logInfo('MoEngage is disabled, removing configuration');
    await removeMoengage(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  // Klaviyo integration
  if (apptileConfig.feature_flags?.ENABLE_KLAVIYO) {
    logInfo('Klaviyo is enabled, adding configuration');
    await addKlaviyo(
      androidManifest,
      stringsObj,
      apptileConfig,
      extraModules,
      parsedReactNativeConfig,
    );
  } else {
    logInfo('Klaviyo is disabled, removing configuration');
    await removeKlaviyo(
      androidManifest,
      stringsObj,
      extraModules,
      parsedReactNativeConfig,
    );
  }

  console.log('androidManifest' + JSON.stringify(stringsObj));

  const strObj = JSON.parse(JSON.stringify(stringsObj));

  logInfo('Writing updated XML files');
  const updatedValuesXml = builder.buildObject(strObj);
  logDebug(`Writing updated strings.xml to: ${valuesXmlPath}`);
  logDebug(`Writing updated AndroidManifest.xml to: ${androidManifestPath}`);
  const updatedAndroidManifest = builder.buildObject(androidManifest);

  await writeFile(androidManifestPath, updatedAndroidManifest);
  logInfo('XML files updated successfully');

  // Get the manifest to identify latest appconfig, then write appConfig.json and localBundleTracker.json
  logInfo('Downloading app manifest and configuration');
  try {
    const manifestUrl = `${apptileConfig.APPTILE_BACKEND_URL}/api/v2/app/${apptileConfig.APP_ID}/manifest`;
    logDebug(`Downloading manifest from: ${manifestUrl}`);
    const {data: manifest} = await axios.get(manifestUrl);
    logDebug('Manifest downloaded successfully');

    const publishedCommit = manifest.forks[0].publishedCommitId;
    logDebug(`Published commit ID: ${publishedCommit || 'none'}`);

    const androidBundle = manifest.codeArtefacts.find(
      it => it.type === 'android-bundle',
    );
    logDebug(`Android bundle ID: ${androidBundle?.id || 'none'}`);

    const bundleTrackerPath = path.resolve(
      __dirname,
      'android/app/src/main/assets/localBundleTracker.json',
    );

    if (publishedCommit) {
      const appConfigUrl = `${apptileConfig.APPCONFIG_SERVER_URL}/${apptileConfig.APP_ID}/main/main/${publishedCommit}.json`;
      logInfo(`Downloading appConfig from: ${appConfigUrl}`);

      const assetsDir = path.resolve(__dirname, 'android/app/src/main/assets');
      logDebug(`Ensuring assets directory exists: ${assetsDir}`);
      await mkdir(assetsDir, {recursive: true});

      const appConfigPath = path.resolve(assetsDir, 'appConfig.json');
      await downloadFile(appConfigUrl, appConfigPath);
      logInfo('appConfig downloaded successfully');

      const bundleTrackerContent = `{"publishedCommitId": ${
        publishedCommit || 'null'
      }, "androidBundleId": ${androidBundle?.id || 'null'}}`;
      logDebug(`Writing bundle tracker: ${bundleTrackerContent}`);
      await writeFile(bundleTrackerPath, bundleTrackerContent);
    } else {
      logError('Published appconfig not found!');
      const bundleTrackerContent = `{"publishedCommitId": null, "androidBundleId": null}`;
      logDebug(`Writing empty bundle tracker: ${bundleTrackerContent}`);
      await writeFile(bundleTrackerPath, bundleTrackerContent);
    }
  } catch (err) {
    logError(`Failed to download appconfig: ${err.message}`);
    const bundleTrackerContent = `{"publishedCommitId": null, "androidBundleId": null}`;
    logDebug(
      `Writing empty bundle tracker due to error: ${bundleTrackerContent}`,
    );
    await writeFile(bundleTrackerPath, bundleTrackerContent);
  }
  logInfo('Generating analytics and finalizing setup');
  logDebug('Generating analytics from template');
  await generateAnalytics(
    analyticsTemplateRef,
    apptileConfig.integrations,
    apptileConfig.feature_flags,
  );

  logDebug('Writing updated React Native config');
  await writeReactNativeConfigJs(parsedReactNativeConfig);

  const extraModulesPath = path.resolve(__dirname, 'extra_modules.json');
  logDebug(`Writing extra modules to: ${extraModulesPath}`);
  await writeFile(
    extraModulesPath,
    JSON.stringify(extraModules.current, null, 2),
  );

  // Update google-services.json
  logInfo('Updating Firebase configuration');
  const googleServicesPath = path.resolve(
    __dirname,
    'android',
    'app',
    'google-services.json',
  );
  logDebug(`Google services path: ${googleServicesPath}`);

  let downloadedGoogleServices = false;
  logDebug(
    `Checking ${apptileConfig.assets?.length || 0} assets for Firebase config`,
  );

  for (let i = 0; i < (apptileConfig.assets?.length || 0); ++i) {
    try {
      const asset = apptileConfig.assets[i];
      if (asset.assetClass === 'androidFirebaseServiceFile') {
        logInfo(`Downloading Firebase config from: ${asset.url}`);
        await downloadFile(asset.url, googleServicesPath);
        downloadedGoogleServices = true;
        logInfo('Firebase config downloaded successfully');
        break;
      }
    } catch (err) {
      logError(`Failed to download google-services.json: ${err.message}`);
    }
  }

  if (!downloadedGoogleServices) {
    logWarning(
      'Failed to download google-services.json. Will try to use the template',
    );
    try {
      const gsRaw = await readFile(googleServicesPath, {encoding: 'utf8'});
      const gsParsed = JSON.parse(gsRaw);
      logDebug(`Updating package name to: ${apptileConfig.android?.bundle_id}`);
      gsParsed.client[0].client_info.android_client_info.package_name =
        apptileConfig.android?.bundle_id;
      await writeFile(googleServicesPath, JSON.stringify(gsParsed, null, 2));
      logInfo('Updated Firebase config with correct package name');
    } catch (err) {
      logError(
        `Failed to update template google-services.json: ${err.message}`,
      );
    }
  }

  // Update version code and version name in version.properties file
  if (
    apptileConfig.android &&
    (apptileConfig.android.build_number || apptileConfig.android.version)
  ) {
    logInfo('Updating app version information');
    const versionPropsPath = path.resolve(
      androidFolderLocation,
      'app/version.properties',
    );
    logDebug(`Version properties path: ${versionPropsPath}`);

    // Prepare content for version.properties
    let propsContent = '';

    // Add version code (build_number) if available
    if (apptileConfig.android.build_number) {
      logInfo(
        `Setting app version code to ${apptileConfig.android.build_number}`,
      );
      propsContent += `VERSION_CODE=${apptileConfig.android.build_number}\n`;
    }

    // Add version name (semver) if available
    if (apptileConfig.android.version) {
      logInfo(`Setting app version name to ${apptileConfig.android.version}`);
      propsContent += `VERSION_NAME=${apptileConfig.android.version}\n`;
    }

    // Write version.properties file
    logDebug(`Writing version properties: ${propsContent.replace(/\n/g, ' ')}`);
    await writeFile(versionPropsPath, propsContent);
    logInfo('Version information updated successfully');
  }

  logInfo('========== ANDROID PROJECT SETUP COMPLETED ==========');
}

logInfo('Executing main function');
logDebug(
  'Process environment variables: ' +
    JSON.stringify(process.env, (key, value) => {
      // Filter out sensitive information
      if (
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token')
      ) {
        return '[REDACTED]';
      }
      return value;
    }),
);

main()
  .then(() => {
    logInfo('Android setup completed successfully');
    logDebug('All operations completed without errors');
    console.log('========== ANDROID PROJECT SETUP COMPLETED ==========');
  })
  .catch(e => {
    logError('Android setup failed:');
    logDebug(`Error type: ${e.constructor.name}`);
    logDebug(`Error message: ${e.message}`);
    logDebug(`Error stack: ${e.stack}`);
    console.error(e);
    console.log('========== ANDROID PROJECT SETUP FAILED ==========');
    process.exit(1);
  });

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
