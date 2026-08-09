// This file is executed in the 'Apptile Setup' build phases step in the ios project.
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

const xcode = require('xcode');
const plist = require('plist');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const util = require('util');
const {exec: exec_} = require('child_process');
const {readFile, writeFile, rmdir, rename} = require('node:fs/promises');

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
  updateAppleTeamID,
} = require('./commonProjectSetup');

const exec = util.promisify(exec_);

async function generateIconSet(scriptPath) {
  await exec(
    `${scriptPath} ${path.resolve(__dirname, 'assets', 'icon.png')} ./`,
    {cwd: path.resolve(__dirname)},
  );
  await rmdir(
    path.resolve(__dirname, 'ios', 'apptileSeed', 'Images.xcassets'),
    {recursive: true},
  );
  await rename(
    path.resolve(__dirname, 'Images.xcassets'),
    path.resolve(__dirname, 'ios', 'apptileSeed', 'Images.xcassets'),
  );
}

async function addCleverTap(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  const LOG_PREFIX = '[CleverTap][iOS]';
  if (!apptileConfig.integrations.cleverTap) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} CleverTap is enabled but seems like its not connected`,
      ),
    );
    throw new Error(
      'Missing apptileConfig.integrations.cleverTap object not found',
    );
  }
  console.log(`${LOG_PREFIX} Initializing CleverTap integration`);
  const cleverTapIntegration = apptileConfig.integrations.cleverTap;
  if (!cleverTapIntegration.cleverTap_id) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} CleverTap is connected but its account id is missing`,
      ),
    );
    throw new Error(
      'cleverTap_id is not found inside apptileConfig.integrations.cleverTap',
    );
  }
  if (!cleverTapIntegration.cleverTap_token) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} CleverTap is connected but its token is missing`,
      ),
    );
    throw new Error(
      'cleverTap_token is not found inside apptileConfig.integrations.cleverTap',
    );
  }
  if (!cleverTapIntegration.cleverTap_region) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} CleverTap is connected but its region is missing`,
      ),
    );
    throw new Error(
      'cleverTap_region is not found inside apptileConfig.integrations.cleverTap',
    );
  }
  console.log(`${LOG_PREFIX} Adding CleverTap config to Info.plist`);
  infoPlist.CleverTapAccountID = cleverTapIntegration.cleverTap_id;
  infoPlist.CleverTapToken = cleverTapIntegration.cleverTap_token;
  infoPlist.CleverTapRegion = cleverTapIntegration.cleverTap_region;
  imageNotificationPlist.NSExtension.NSExtensionPrincipalClass =
    'CTNotificationServiceExtension';
  await removeForceUnlinkForNativePackage(
    'clevertap-react-native',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} CleverTap integration complete`);
}

async function removeCleverTap(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  if (infoPlist.CleverTapAccountID) {
    delete infoPlist.CleverTapAccountID;
  }
  if (infoPlist.CleverTapToken) {
    delete infoPlist.CleverTapToken;
  }
  if (infoPlist.CleverTapRegion) {
    delete infoPlist.CleverTapRegion;
  }
  if (
    imageNotificationPlist.NSExtension?.NSExtensionPrincipalClass ===
    'CTNotificationServiceExtension'
  ) {
    imageNotificationPlist.NSExtension.NSExtensionPrincipalClass =
      'NotificationService';
  }
  await addForceUnlinkForNativePackage(
    'clevertap-react-native',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addMoengage(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  const LOG_PREFIX = '[MoEngage][iOS]';
  if (!apptileConfig.integrations.moengage) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} MoEngage is enabled but seems like its not connected`,
      ),
    );
    throw new Error(
      'Missing apptileConfig.integrations.moengage object not found',
    );
  }
  console.log(`${LOG_PREFIX} Initializing MoEngage integration`);
  const moengageIntegration = apptileConfig.integrations.moengage;
  if (!moengageIntegration.appId) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} MoEngage is connected but its app id is missing`,
      ),
    );
    throw new Error(
      'appId is not found inside apptileConfig.integrations.moengage',
    );
  }
  if (!moengageIntegration.datacenter) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} MoEngage is connected but its datacenter is missing`,
      ),
    );
    throw new Error(
      'datacenter is not found inside apptileConfig.integrations.moengage',
    );
  }
  console.log(`${LOG_PREFIX} Adding MoEngage config to Info.plist`);
  infoPlist.MOENGAGE_APPID = moengageIntegration.appId;
  infoPlist.MOENGAGE_DATACENTER = moengageIntegration.datacenter;
  infoPlist.MoEngageAppDelegateProxyEnabled = false;
  infoPlist.MoEngage = {
    ENABLE_LOGS: false,
    MOENGAGE_APP_ID: moengageIntegration.appId,
    DATA_CENTER: moengageIntegration.datacenter,
    APP_GROUP_ID: `group.${apptileConfig.ios.bundle_id}.notification`,
  };
  notificationContentInfoPlist.NSExtension.NSExtensionAttributes.UNNotificationExtensionCategory =
    'MOE_PUSH_TEMPLATE';
  notificationContentInfoPlist.NSExtension.NSExtensionAttributes.UNNotificationExtensionInitialContentSizeRatio = 1.2;
  notificationContentInfoPlist.NSExtension.NSExtensionAttributes.UNNotificationExtensionUserInteractionEnabled = true;
  notificationContentInfoPlist.NSExtension.NSExtensionAttributes.UNNotificationExtensionDefaultContentHidden = true;

  await removeForceUnlinkForNativePackage(
    'react-native-moengage',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} MoEngage integration complete`);
}

async function removeMoengage(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  if (infoPlist.MOENGAGE_APPID) {
    delete infoPlist.MOENGAGE_APPID;
  }
  if (infoPlist.MOENGAGE_DATACENTER) {
    delete infoPlist.MOENGAGE_DATACENTER;
  }
  if (infoPlist.MoEngageAppDelegateProxyEnabled) {
    delete infoPlist.MoEngageAppDelegateProxyEnabled;
  }
  if (infoPlist.MoEngage) {
    delete infoPlist.MoEngage;
  }
  if (
    notificationContentInfoPlist.NSExtension?.NSExtensionAttributes
      ?.UNNotificationExtensionCategory
  ) {
    delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
      .UNNotificationExtensionCategory;
  }
  if (
    notificationContentInfoPlist.NSExtension?.NSExtensionAttributes
      ?.UNNotificationExtensionInitialContentSizeRatio
  ) {
    delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
      .UNNotificationExtensionInitialContentSizeRatio;
  }
  if (
    notificationContentInfoPlist.NSExtension?.NSExtensionAttributes
      ?.UNNotificationExtensionUserInteractionEnabled
  ) {
    delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
      .UNNotificationExtensionUserInteractionEnabled;
  }
  if (
    notificationContentInfoPlist.NSExtension?.NSExtensionAttributes
      ?.UNNotificationExtensionDefaultContentHidden
  ) {
    delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
      .UNNotificationExtensionDefaultContentHidden;
  }

  await addForceUnlinkForNativePackage(
    'react-native-moengage',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addKlaviyo(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  const LOG_PREFIX = '[Klaviyo][iOS]';
  if (!apptileConfig.integrations.klaviyo) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} Klaviyo is enabled but seems like its not connected`,
      ),
    );
    throw new Error(
      'Missing apptileConfig.integrations.klaviyo object not found',
    );
  }
  console.log(`${LOG_PREFIX} Initializing Klaviyo integration`);
  const klaviyoCompanyId =
    apptileConfig.integrations.klaviyo.klaviyo_company_id;
  if (!klaviyoCompanyId) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} Klaviyo is connected but its company id is missing`,
      ),
    );
    throw new Error(
      'klaviyo_company_id is not found inside apptileConfig.integrations.klaviyo',
    );
  }
  console.log(`${LOG_PREFIX} Adding Klaviyo config to Info.plist`);
  infoPlist.klaviyo_company_id = klaviyoCompanyId;
  infoPlist.FirebaseAppDelegateProxyEnabled = false;
  imageNotificationPlist.APPTILE_DEFAULT_NOTIFICATION_TITLE =
    apptileConfig.app_name || 'Apptile';
  await removeForceUnlinkForNativePackage(
    'klaviyo-react-native-sdk',
    extraModules,
    parsedReactNativeConfig,
  );
  await removeForceUnlinkForNativePackage(
    '@react-native-community/push-notification-ios',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} Klaviyo integration complete`);
}

async function removeKlaviyo(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  if (infoPlist.klaviyo_company_id) {
    delete infoPlist.klaviyo_company_id;
  }
  if (imageNotificationPlist.APPTILE_DEFAULT_NOTIFICATION_TITLE) {
    delete imageNotificationPlist.APPTILE_DEFAULT_NOTIFICATION_TITLE;
  }
  await addForceUnlinkForNativePackage(
    'klaviyo-react-native-sdk',
    extraModules,
    parsedReactNativeConfig,
  );
  await addForceUnlinkForNativePackage(
    '@react-native-community/push-notification-ios',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addAppsflyer(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  if (!apptileConfig.integrations.appsflyer) {
    throw new Error('appsflyer is not connected');
  }
  const appsflyerIntegration = apptileConfig.integrations.appsflyer;
  if (!appsflyerIntegration.devkey) {
    throw new Error('appsflyer devkey is missing');
  }
  if (!appsflyerIntegration.appId) {
    throw new Error('appsflyer appId is missing');
  }
  infoPlist.APPSFLYER_DEVKEY = appsflyerIntegration.devkey;
  infoPlist.APPSFLYER_APPID = appsflyerIntegration.appId;

  removeForceUnlinkForNativePackage(
    'react-native-appsflyer',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeAppsflyer(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  if (infoPlist.APPSFLYER_DEVKEY) {
    delete infoPlist.APPSFLYER_DEVKEY;
  }
  if (infoPlist.APPSFLYER_APPID) {
    delete infoPlist.APPSFLYER_APPID;
  }

  await addForceUnlinkForNativePackage(
    'react-native-appsflyer',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addFacebook(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  const LOG_PREFIX = '[Facebook][iOS]';
  if (!apptileConfig.integrations.metaAds) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} Facebook is enabled but seems like its not connected`,
      ),
    );
    throw new Error(
      'Missing apptileConfig.integrations.metaAds object not found',
    );
  }
  console.log(`${LOG_PREFIX} Initializing Facebook integration`);
  const metaIntegration = apptileConfig.integrations.metaAds;
  if (!metaIntegration.fb_appId) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} Facebook is connected but its app id is missing`,
      ),
    );
    throw new Error(
      'fb_appId is not found inside apptileConfig.integrations.metaAds',
    );
  }
  if (!metaIntegration.fb_clientToken) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} Facebook is connected but its client token is missing`,
      ),
    );
    throw new Error(
      'fb_clientToken is not found inside apptileConfig.integrations.metaAds',
    );
  }
  console.log(`${LOG_PREFIX} Adding Facebook config to Info.plist`);
  infoPlist.FacebookAppID = metaIntegration.fb_appId;
  infoPlist.FacebookClientToken = metaIntegration.fb_clientToken;
  infoPlist.FacebookDisplayName = apptileConfig.app_name;
  infoPlist.FacebookAutoLogAppEventsEnabled = true;
  infoPlist.FacebookAdvertiserIDCollectionEnabled = false;
  removeForceUnlinkForNativePackage(
    'react-native-fbsdk-next',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} Facebook integration complete`);
}
async function removeFacebook(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  if (infoPlist.FacebookAppID) {
    delete infoPlist.FacebookAppID;
  }
  if (infoPlist.FacebookClientToken) {
    delete infoPlist.FacebookClientToken;
  }
  if (infoPlist.FacebookDisplayName) {
    delete infoPlist.FacebookDisplayName;
  }
  if (infoPlist.FacebookAutoLogAppEventsEnabled) {
    delete infoPlist.FacebookAutoLogAppEventsEnabled;
  }
  if (infoPlist.FacebookAdvertiserIDCollectionEnabled) {
    delete infoPlist.FacebookAdvertiserIDCollectionEnabled;
  }
  addForceUnlinkForNativePackage(
    'react-native-fbsdk-next',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addOnesignal(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  const LOG_PREFIX = '[OneSignal][iOS]';
  if (!apptileConfig.integrations.oneSignal) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} OneSignal is enabled but seems like its not connected`,
      ),
    );
    throw new Error(
      'Missing apptileConfig.integrations.oneSignal object not found',
    );
  }
  console.log(`${LOG_PREFIX} Initializing OneSignal integration`);
  const onesignalIntegration = apptileConfig.integrations.oneSignal;
  if (!onesignalIntegration.onesignal_app_id) {
    console.log(
      chalk.red(
        `${LOG_PREFIX} OneSignal is connected but its app id is missing`,
      ),
    );
    throw new Error(
      'onesignal_app_id is not found inside apptileConfig.integrations.oneSignal',
    );
  }
  console.log(`${LOG_PREFIX} Adding OneSignal config to Info.plist`);
  infoPlist.ONESIGNAL_APPID = onesignalIntegration.onesignal_app_id;
  removeForceUnlinkForNativePackage(
    'react-native-onesignal',
    extraModules,
    parsedReactNativeConfig,
  );
  console.log(`${LOG_PREFIX} OneSignal integration complete`);
}

async function removeOnesignal(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  if (infoPlist.ONESIGNAL_APPID) {
    delete infoPlist.ONESIGNAL_APPID;
  }
  addForceUnlinkForNativePackage(
    'react-native-onesignal',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addLogrocket(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  infoPlist.ENABLE_LOGROCKET = 'true';
  removeForceUnlinkForNativePackage(
    '@logrocket/react-native',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeLogrocket(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  delete infoPlist.ENABLE_LOGROCKET;

  // LogRocket is initialized in JS (App.tsx), no native config needed
  addForceUnlinkForNativePackage(
    '@logrocket/react-native',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addAppTrackingTransparency(infoPlist, apptileConfig) {
  const defaultMessage =
    apptileConfig.appTrackingTransparencyMessage ||
    'Opting in to tracking allows our App to provide personalized offering to you across a variety of channels. This helps us show you the products and recommendations that you would be most interested in.';

  infoPlist.NSUserTrackingUsageDescription = defaultMessage;
}

async function removeAppTrackingTransparency(infoPlist) {
  delete infoPlist.NSUserTrackingUsageDescription;
}

async function updateTargetedDeviceFamily(enableIpad) {
  const LOG_PREFIX = '[iPad Support][iOS]';
  const pbxprojPath = path.resolve(
    __dirname,
    'ios',
    'apptileSeed.xcodeproj',
    'project.pbxproj',
  );

  // TARGETED_DEVICE_FAMILY: 1 = iPhone only, 2 = iPad only, "1,2" = Universal
  const targetValue = enableIpad ? '"1,2"' : '"1"';

  const project = xcode.project(pbxprojPath);

  // Parse the project file synchronously
  await new Promise((resolve, reject) => {
    project.parse(err => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Get all build configurations and update TARGETED_DEVICE_FAMILY
  const buildConfigs = project.pbxXCBuildConfigurationSection();

  for (const configKey in buildConfigs) {
    const config = buildConfigs[configKey];
    if (config.buildSettings && config.buildSettings.TARGETED_DEVICE_FAMILY) {
      config.buildSettings.TARGETED_DEVICE_FAMILY = targetValue;
    }
  }

  // Write the updated project file
  fs.writeFileSync(pbxprojPath, project.writeSync());
  console.log(`${LOG_PREFIX} Set TARGETED_DEVICE_FAMILY = ${targetValue}`);
}

async function addIpadSupport(infoPlist) {
  const LOG_PREFIX = '[iPad Support][iOS]';
  // Set orientations for iPhone (portrait only by default)
  infoPlist.UISupportedInterfaceOrientations = [
    'UIInterfaceOrientationPortrait',
  ];

  // Set orientations for iPad (all orientations)
  infoPlist['UISupportedInterfaceOrientations~ipad'] = [
    'UIInterfaceOrientationPortrait',
    'UIInterfaceOrientationPortraitUpsideDown',
    'UIInterfaceOrientationLandscapeLeft',
    'UIInterfaceOrientationLandscapeRight',
  ];

  // Update TARGETED_DEVICE_FAMILY in project.pbxproj to "1,2"
  await updateTargetedDeviceFamily(true);
  console.log(`${LOG_PREFIX} Enabled iPad support`);
}

async function removeIpadSupport(infoPlist) {
  const LOG_PREFIX = '[iPad Support][iOS]';
  // Keep only portrait for iPhone
  infoPlist.UISupportedInterfaceOrientations = [
    'UIInterfaceOrientationPortrait',
  ];

  // Remove iPad-specific orientations
  delete infoPlist['UISupportedInterfaceOrientations~ipad'];

  // Update TARGETED_DEVICE_FAMILY in project.pbxproj to "1"
  await updateTargetedDeviceFamily(false);
  console.log(`${LOG_PREFIX} Disabled iPad support`);
}

async function addZego(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  // Add camera and microphone permissions for live streaming
  infoPlist.NSCameraUsageDescription =
    apptileConfig.cameraPermissionMessage || 'Access camera for live streaming';
  infoPlist.NSMicrophoneUsageDescription =
    apptileConfig.microphonePermissionMessage ||
    'Microphone for Live Streaming';

  // Add ENABLE_LIVELY_PIP to Info.plist when PIP is enabled
  const enableLivelyPIP = apptileConfig.feature_flags?.ENABLE_LIVELY_PIP;
  logFeature('LivelyPIP', enableLivelyPIP);
  if (enableLivelyPIP) {
    infoPlist.ENABLE_LIVELY_PIP = 'true';
    // Add UIBackgroundModes for audio to support PIP
    infoPlist.UIBackgroundModes = ['audio'];
  } else {
    // Remove ENABLE_LIVELY_PIP and UIBackgroundModes when PIP is disabled (even if ENABLE_LIVELY is true)
    delete infoPlist.ENABLE_LIVELY_PIP;
    delete infoPlist.UIBackgroundModes;
  }

  // Check if we should use local PIP version
  if (apptileConfig.feature_flags?.ENABLE_LIVELY_PIP) {
    // Use local copy instead of node_modules
    parsedReactNativeConfig.dependencies['zego-express-engine-reactnative'] = {
      root: path.resolve(__dirname, './zego-express-engine-reactnative'),
      platforms: {
        ios: {
          podspecPath: path.resolve(
            __dirname,
            './zego-express-engine-reactnative/react-native-zego-express-engine.podspec',
          ),
          version: '3.14.5',
          configurations: [],
          scriptPhases: [],
        },
        android: {
          sourceDir: path.resolve(
            __dirname,
            './zego-express-engine-reactnative/android',
          ),
          packageImportPath:
            'import im.zego.reactnative.RCTZegoExpressEnginePackage;',
          packageInstance: 'new RCTZegoExpressEnginePackage()',
          buildTypes: [],
          componentDescriptors: [],
          cmakeListsPath: path.resolve(
            __dirname,
            './zego-express-engine-reactnative/android/build/generated/source/codegen/jni/CMakeLists.txt',
          ),
        },
      },
    };
  } else {
    // Use regular node_modules version
    await removeForceUnlinkForNativePackage(
      'zego-express-engine-reactnative',
      extraModules,
      parsedReactNativeConfig,
    );
  }
}

async function removeZego(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  // Remove camera and microphone permissions
  // delete infoPlist.NSCameraUsageDescription;
  // delete infoPlist.NSMicrophoneUsageDescription;

  // Remove ENABLE_LIVELY_PIP from Info.plist
  delete infoPlist.ENABLE_LIVELY_PIP;

  // Remove UIBackgroundModes
  delete infoPlist.UIBackgroundModes;

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
    console.log(`[FeatureFlag] ${feature} → DISABLED`);
  }
}

async function main() {
  const analyticsTemplateRef = {current: analyticsTemplate};

  try {
    // Get location of ios folder in project
    const iosFolderLocation = path.resolve(__dirname, 'ios');

    // Read apptile.config.json
    console.log(
      'Pulling in configurations from apptile.config.json to Info.plist',
    );
    const apptileConfigRaw = await readFile(
      path.resolve(iosFolderLocation, '../apptile.config.json'),
      {encoding: 'utf8'},
    );
    const apptileConfig = JSON.parse(apptileConfigRaw);
    const success = await downloadIconAndSplash(apptileConfig);
    if (success && os.platform() === 'darwin') {
      await generateIconSet(
        path.resolve(__dirname, 'scripts/ios/iconset-generator.sh'),
      );
    }

    const extraModules = getExtraModules(apptileConfig);

    // Notification Content extension Info.plist
    const notificationContentExtensionInfoPlistLocation = path.resolve(
      iosFolderLocation,
      'NotificationContentExtension/Info.plist',
    );
    const rawNotificationContentExtensionPlist = await readFile(
      notificationContentExtensionInfoPlistLocation,
      {encoding: 'utf8'},
    );
    const notificationContentExtensionPlist = plist.parse(
      rawNotificationContentExtensionPlist,
    );

    // ImageNotification Info.plist
    const imageNotificationInfoPlistLocation = path.resolve(
      iosFolderLocation,
      'ImageNotification/Info.plist',
    );
    const rawImageNotificationPlist = await readFile(
      imageNotificationInfoPlistLocation,
      {encoding: 'utf8'},
    );
    const imageNotificationPlist = plist.parse(rawImageNotificationPlist);

    // Entitlements
    const apptileSeedEntitlementsLocation = path.resolve(
      iosFolderLocation,
      'apptileSeed',
      'apptileSeed.entitlements',
    );
    const rawApptileSeedEntitlements = await readFile(
      apptileSeedEntitlementsLocation,
      {encoding: 'utf8'},
    );
    const apptileSeedEntitlements = plist.parse(rawApptileSeedEntitlements);

    const imageNotificationEntitlementsLocation = path.resolve(
      iosFolderLocation,
      'ImageNotification',
      'ImageNotification.entitlements',
    );
    const rawImageNotifEntitlements = await readFile(
      imageNotificationEntitlementsLocation,
      {encoding: 'utf8'},
    );
    const imageNotificationEntitlements = plist.parse(
      rawImageNotifEntitlements,
    );

    const notificationContentEntitlementsLocation = path.resolve(
      iosFolderLocation,
      'NotificationContentExtension',
      'NotificationContentExtension.entitlements',
    );
    const rawNotifContentEntitlements = await readFile(
      notificationContentEntitlementsLocation,
      {encoding: 'utf8'},
    );
    const notificationContentEntitlements = plist.parse(
      rawNotifContentEntitlements,
    );

    // Add Info.plist updates
    const infoPlistLocation = path.resolve(
      iosFolderLocation,
      'apptileSeed/Info.plist',
    );
    const rawInfoPlist = await readFile(infoPlistLocation, {encoding: 'utf8'});
    const infoPlist = plist.parse(rawInfoPlist);

    // Get version and build number from apptileConfig
    const app_version = apptileConfig.ios?.version || '1.0.0';
    const build_number = apptileConfig.ios?.build_number || '1';
    console.log(
      `Setting app version to ${app_version} and build number to ${build_number}`,
    );

    // Update main app Info.plist with version and build number
    infoPlist.CFBundleShortVersionString = app_version;
    infoPlist.CFBundleVersion = build_number;

    // Also update ImageNotification Info.plist with version and build number
    imageNotificationPlist.CFBundleShortVersionString = app_version;
    imageNotificationPlist.CFBundleVersion = build_number;

    // Also update NotificationContentExtension Info.plist with version and build number
    notificationContentExtensionPlist.CFBundleShortVersionString = app_version;
    notificationContentExtensionPlist.CFBundleVersion = build_number;

    infoPlist.APPTILE_API_ENDPOINT = apptileConfig.APPTILE_BACKEND_URL;
    infoPlist.APPTILE_UPDATE_ENDPOINT = apptileConfig.APPCONFIG_SERVER_URL;
    infoPlist.APP_ID = apptileConfig.APP_ID;
    infoPlist.CFBundleDisplayName = apptileConfig.app_name || 'Apptile Seed';
    infoPlist.APPTILE_APP_HOST =
      `https://${apptileConfig.app_host}` || 'apptile.com';
    infoPlist.APPTILE_APP_HOST_2 =
      `https://${apptileConfig.app_host_2}` || 'apptile.io';
    infoPlist.APPTILE_URL_SCHEME = `${apptileConfig.url_scheme}://`;

    // Add GIF_SPLASH_DURATION from feature_flags
    const gifSplashDuration =
      apptileConfig.feature_flags?.GIF_SPLASH_DURATION || 4;
    infoPlist.GIF_SPLASH_DURATION = String(gifSplashDuration);

    const bundle_id =
      apptileConfig.ios?.bundle_id || 'com.apptile.apptilepreviewdemo';

    if (apptileConfig.url_scheme) {
      // Initialize CFBundleURLTypes if it doesn't exist
      if (!infoPlist.CFBundleURLTypes) {
        infoPlist.CFBundleURLTypes = [];
      }

      // Initialize the first entry if it doesn't exist
      if (!infoPlist.CFBundleURLTypes[0]) {
        infoPlist.CFBundleURLTypes[0] = {
          CFBundleTypeRole: 'Editor',
          CFBundleURLName: bundle_id,
          CFBundleURLSchemes: [],
        };
      }

      infoPlist.CFBundleURLTypes[0].CFBundleURLName = bundle_id;
      infoPlist.CFBundleURLTypes[0].CFBundleURLSchemes = [
        apptileConfig.url_scheme,
      ];
    }

    apptileSeedEntitlements['com.apple.security.application-groups'] = [
      `group.${bundle_id}.notification`,
    ];
    imageNotificationEntitlements['com.apple.security.application-groups'] = [
      `group.${bundle_id}.notification`,
    ];

    // Configure deep linking - Associated Domains for universal links
    // Expand wildcard hosts and exclude account.* subdomain (for Google login to work)
    const associatedDomains = [];
    const baseHost = apptileConfig.app_host;

    if (apptileConfig.app_host && apptileConfig.app_host !== 'null') {
      associatedDomains.push(`applinks:${apptileConfig.app_host}`);
    }
    if (
      apptileConfig.app_host_2 &&
      apptileConfig.app_host_2 !== 'null' &&
      apptileConfig.app_host_2 !== ''
    ) {
      const host2 = apptileConfig.app_host_2;
      if (host2.startsWith('*.')) {
        const wwwHost = `www.${baseHost}`;
        if (!associatedDomains.includes(`applinks:${wwwHost}`)) {
          associatedDomains.push(`applinks:${wwwHost}`);
        }
        // Note: account.* is intentionally excluded so Google login redirects to browser
      } else if (host2 !== `account.${baseHost}`) {
        // Add host if it's not the account subdomain
        associatedDomains.push(`applinks:${host2}`);
      }
    }
    apptileSeedEntitlements['com.apple.developer.associated-domains'] =
      associatedDomains;

    console.log(
      'iOS Associated Domains configured (account.* subdomain excluded for Google login)',
    );

    await updateAppleTeamID(
      apptileConfig.ios?.team_id,
      path.resolve(__dirname),
    );

    // For facebook analytics
    const parsedReactNativeConfig = await readReactNativeConfigJs();

    const isFacebookEnabled = apptileConfig.feature_flags?.ENABLE_FBSDK;
    logFeature('Facebook/MetaAds', isFacebookEnabled);

    if (isFacebookEnabled) {
      await addFacebook(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeFacebook(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // For clevertap analytics
    const isCleverTapEnabled = apptileConfig.feature_flags?.ENABLE_CLEVERTAP;
    logFeature('CleverTap', isCleverTapEnabled);

    if (isCleverTapEnabled) {
      await addCleverTap(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeCleverTap(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // For appsflyer analytics
    const isAppsflyerEnabled = apptileConfig.feature_flags?.ENABLE_APPSFLYER;
    logFeature('AppsFlyer', isAppsflyerEnabled);
    if (isAppsflyerEnabled) {
      await addAppsflyer(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeAppsflyer(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // For moengage analytics
    const isMoengageEnabled = apptileConfig.feature_flags?.ENABLE_MOENGAGE;
    logFeature('MoEngage', isMoengageEnabled);

    if (isMoengageEnabled) {
      await addMoengage(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeMoengage(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // Onesignal notifications
    const isOneSignalEnabled = apptileConfig.feature_flags?.ENABLE_ONESIGNAL;
    logFeature('OneSignal', isOneSignalEnabled);

    if (isOneSignalEnabled) {
      await addOnesignal(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeOnesignal(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // For klaviyo notifications
    const isKlaviyoEnabled = apptileConfig.feature_flags?.ENABLE_KLAVIYO;
    logFeature('Klaviyo', isKlaviyoEnabled);

    if (isKlaviyoEnabled) {
      await addKlaviyo(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeKlaviyo(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // Disable Firebase's push notification delegate when both Firebase Analytics and OneSignal are enabled
    // This prevents delegate conflicts that cause crashes when clicking "Allow" for notifications
    if (
      apptileConfig.feature_flags?.ENABLE_FIREBASE_ANALYTICS &&
      apptileConfig.feature_flags?.ENABLE_ONESIGNAL
    ) {
      infoPlist.FirebaseAppDelegateProxyEnabled = false;
      infoPlist.FirebaseMessagingAutoInitEnabled = false;
      console.log(
        'Firebase + OneSignal: Disabled Firebase push notification handling to prevent delegate conflicts',
      );
    }

    // For zego live streaming
    const isLivelyEnabled = apptileConfig.feature_flags?.ENABLE_LIVELY;
    logFeature('Lively', isLivelyEnabled);
    if (isLivelyEnabled) {
      await addZego(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeZego(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // For LogRocket
    const isLogRocketEnabled = apptileConfig.feature_flags?.ENABLE_LOGROCKET;
    logFeature('LogRocket', isLogRocketEnabled);

    if (isLogRocketEnabled) {
      await addLogrocket(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        apptileConfig,
        parsedReactNativeConfig,
        extraModules,
      );
    } else {
      await removeLogrocket(
        infoPlist,
        imageNotificationPlist,
        notificationContentExtensionPlist,
        extraModules,
        parsedReactNativeConfig,
      );
    }

    // For Segment Analytics
    const isSegmentEnabled =
      apptileConfig.feature_flags?.ENABLE_SEGMENT_ANALYTICS;
    logFeature('Segment', isSegmentEnabled);
    const SEGMENT_LOG_PREFIX = '[Segment][iOS]';

    if (isSegmentEnabled) {
      console.log(
        `${SEGMENT_LOG_PREFIX} Initializing Segment Analytics integration`,
      );
      const segmentKey =
        apptileConfig.apptile_analytics_segment_key ||
        process.env.apptile_analytics_segment_key;
      if (!segmentKey) {
        console.error(
          chalk.red(
            'ENABLE_SEGMENT_ANALYTICS is true but apptile_analytics_segment_key is missing',
          ),
        );
        throw new Error('apptile_analytics_segment_key is missing');
      }
      console.log(`${SEGMENT_LOG_PREFIX} Adding Segment key to Info.plist`);
      infoPlist.APPTILE_ANALYTICS_SEGMENT_KEY = segmentKey;
      console.log(
        `${SEGMENT_LOG_PREFIX} Segment Analytics integration complete`,
      );
    } else {
      delete infoPlist.APPTILE_ANALYTICS_SEGMENT_KEY;
    }

    // Handle Disable Dynamic Type (font scaling)
    const isDisableDynamicTypeEnabled =
      apptileConfig.feature_flags?.DISABLE_DYNAMIC_TYPE;
    logFeature('DisableDynamicType', isDisableDynamicTypeEnabled);

    if (isDisableDynamicTypeEnabled) {
      console.log(
        '[DisableDynamicType][IOS] Adding DISABLE_DYNAMIC_TYPE flag to Info.plist',
      );
      infoPlist.DISABLE_DYNAMIC_TYPE = 'true';
    } else {
      console.log(
        '[DisableDynamicType][IOS] Removing DISABLE_DYNAMIC_TYPE flag from Info.plist',
      );
      delete infoPlist.DISABLE_DYNAMIC_TYPE;
    }

    // For firebase
    const isFirebaseEnabled =
      apptileConfig.feature_flags?.ENABLE_FIREBASE_ANALYTICS;
    logFeature('Firebase Analytics', isFirebaseEnabled);

    // For App Tracking Transparency
    if (
      apptileConfig.feature_flags?.ENABLE_APP_TRACKING_TRANSPARENCY ||
      apptileConfig.feature_flags?.ENABLE_FIREBASE_ANALYTICS ||
      apptileConfig.feature_flags?.ENABLE_FBSDK
    ) {
      logFeature('Enabling App Tracking Transparency', true);
      await addAppTrackingTransparency(infoPlist, apptileConfig);
    } else {
      await removeAppTrackingTransparency(infoPlist);
    }

    // For iPad Support
    const isIpadSupportEnabled =
      apptileConfig.feature_flags?.ENABLE_IPAD_SUPPORT;
    logFeature('iPad Support', isIpadSupportEnabled);

    if (isIpadSupportEnabled) {
      await addIpadSupport(infoPlist);
    } else {
      await removeIpadSupport(infoPlist);
    }

    // Intent Filters handled via #if INTENT_FILTERS preprocessor directive in AppDelegate.mm
    // The INTENT_FILTERS flag is automatically set in GCC_PREPROCESSOR_DEFINITIONS via Podfile
    if (apptileConfig.feature_flags?.INTENT_FILTERS) {
      logFeature('Intent Filters', true);
    } else {
      logFeature('Intent Filters', false);
    }

    // DISABLE_INTENT_FILTER: array of paths to open in browser instead of the app.
    // The path array is written to Info.plist so AppDelegate can read it at runtime.
    const disablePaths = apptileConfig.feature_flags?.DISABLE_INTENT_FILTER;
    if (Array.isArray(disablePaths) && disablePaths.length > 0) {
      infoPlist['DisabledDeepLinkPaths'] = disablePaths;
      logFeature('Disable Intent Filter', true);
      console.log('Disabled deep link paths:', disablePaths);
    } else {
      delete infoPlist['DisabledDeepLinkPaths'];
      logFeature('Disable Intent Filter', false);
    }

    const updatedPlist = plist.build(infoPlist);
    await writeFile(infoPlistLocation, updatedPlist);

    const updatedImageNotificationPlist = plist.build(imageNotificationPlist);
    await writeFile(
      imageNotificationInfoPlistLocation,
      updatedImageNotificationPlist,
    );

    const udpatedNotificationContentPlist = plist.build(
      notificationContentExtensionPlist,
    );
    await writeFile(
      notificationContentExtensionInfoPlistLocation,
      udpatedNotificationContentPlist,
    );

    const updatedApptileSeedEntitlements = plist.build(apptileSeedEntitlements);
    await writeFile(
      apptileSeedEntitlementsLocation,
      updatedApptileSeedEntitlements,
    );

    const updatedImagenotifEntitlements = plist.build(
      imageNotificationEntitlements,
    );
    await writeFile(
      imageNotificationEntitlementsLocation,
      updatedImagenotifEntitlements,
    );

    const updatedNotifContentEntitlements = plist.build(
      notificationContentEntitlements,
    );
    await writeFile(
      notificationContentEntitlementsLocation,
      updatedNotifContentEntitlements,
    );

    const bundleTrackerPath = path.resolve(
      __dirname,
      'ios/localBundleTracker.json',
    );

    // Get the manifest to identify latest appconfig, then write appConfig.json and localBundleTracker.json
    // TODO(gaurav): use the cdn here as well
    try {
      const manifestUrl = `${apptileConfig.APPCONFIG_SERVER_URL}/app/${
        apptileConfig.APP_ID
      }/${apptileConfig.fork_name || 'main'}/manifest?frameworkVersion=0.17.0`;
      console.log('Downloading manifest from ' + manifestUrl);
      const {data: manifest} = await axios.get(manifestUrl);
      const publishedCommit = manifest.publishedCommitId;
      const iosBundle = manifest.artefacts.find(
        it => it.type === 'ios-jsbundle',
      );

      if (publishedCommit) {
        const appConfigUrl =
          manifest.url ||
          `${apptileConfig.APPCONFIG_SERVER_URL}/${apptileConfig.APP_ID}/${
            apptileConfig.fork_name || 'main'
          }/main/${publishedCommit}.json`;
        console.log('Downloading appConfig from: ' + appConfigUrl);
        const appConfigPath = path.resolve(__dirname, 'ios/appConfig.json');
        await downloadFile(appConfigUrl, appConfigPath);
        console.log(chalk.green('APPCONFIG DOWNLOADED'));
        await writeFile(
          bundleTrackerPath,
          `{"publishedCommitId": ${publishedCommit}, "iosBundleId": ${
            iosBundle?.id ?? 'null'
          }}`,
        );
      } else {
        console.error('Published appconfig not found!');
        await writeFile(
          bundleTrackerPath,
          `{"publishedCommitId": null, "iosBundleId": null}`,
        );
      }
    } catch (err) {
      console.error('Failed to download appconfig:', err.message);
      await writeFile(
        bundleTrackerPath,
        `{"publishedCommitId": null, "iosBundleId": null}`,
      );
      throw new Error(`Failed to download appconfig: ${err.message}`);
    }

    await generateAnalytics(
      analyticsTemplateRef,
      apptileConfig.integrations,
      apptileConfig.feature_flags,
    );
    await writeReactNativeConfigJs(parsedReactNativeConfig);

    // Always ensure react-native-push-notification stub is registered
    // This is required because apptile-core's Firebase Analytics calls PushNotification.configure()
    // but the native module is force-unlinked (OneSignal handles all push notifications)
    await addForceUnlinkForNativePackage(
      'react-native-push-notification',
      extraModules,
      parsedReactNativeConfig,
    );
    console.log(
      'react-native-push-notification stub always registered for Firebase/OneSignal compatibility',
    );

    await writeFile(
      path.resolve(__dirname, 'extra_modules.json'),
      JSON.stringify(extraModules.current, null, 2),
    );

    // Download GoogleService-Info.plist only if ENABLE_FIREBASE_ANALYTICS is true
    const enableFirebaseAnalytics =
      apptileConfig.feature_flags?.ENABLE_FIREBASE_ANALYTICS;
    logFeature('Firebase Analytics', enableFirebaseAnalytics);
    if (enableFirebaseAnalytics) {
      const googleServiceInfoPath = path.resolve(
        __dirname,
        'ios',
        'GoogleService-Info.plist',
      );
      let downloadedGoogleServiceInfo = false;
      for (let i = 0; i < apptileConfig.assets.length; ++i) {
        try {
          const asset = apptileConfig.assets[i];
          if (asset.assetClass === 'iosFirebaseServiceFile') {
            await downloadFile(asset.url, googleServiceInfoPath);
            downloadedGoogleServiceInfo = true;
            console.log(
              chalk.green('GoogleService-Info.plist downloaded successfully'),
            );
            break;
          }
        } catch (err) {
          console.error(
            'Failed to download GoogleService-Info.plist:',
            err.message,
          );
        }
      }

      if (!downloadedGoogleServiceInfo) {
        console.error(
          chalk.red(
            '❌ Failed to download GoogleService-Info.plist. ENABLE_FIREBASE_ANALYTICS is true but no Firebase config file found in assets.',
          ),
        );
      }
    }
  } catch (err) {
    console.error('Uncaught exception in iosProjectSetup: ', err);
    process.exit(1);
  }
}

main();
