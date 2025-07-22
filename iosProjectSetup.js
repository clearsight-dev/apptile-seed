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

// const xcode = require('xcode');
const plist = require('plist');
// const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
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
  const cleverTapIntegration = apptileConfig.integrations.cleverTap;
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
}

async function removeCleverTap(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  infoPlist.CleverTapAccountID = 'xxx';
  infoPlist.CleverTapToken = 'xxx';
  infoPlist.CleverTapRegion = 'xxx';
  if (
    imageNotificationPlist.NSExtension.NSExtensionPrincipalClass ===
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
  const moengageIntegration = apptileConfig.integrations.moengage;
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
}

async function removeMoengage(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  infoPlist.MOENGAGE_APPID = 'xxx';
  infoPlist.MOENGAGE_DATACENTER = 'xxx';
  infoPlist.MoEngageAppDelegateProxyEnabled = 'xxx';
  infoPlist.MoEngage = 'xxx';
  delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
    .UNNotificationExtensionCategory;
  delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
    .UNNotificationExtensionInitialContentSizeRatio;
  delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
    .UNNotificationExtensionUserInteractionEnabled;
  delete notificationContentInfoPlist.NSExtension.NSExtensionAttributes
    .UNNotificationExtensionDefaultContentHidden;

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
  imageNotificationPlist.APPTILE_DEFAULT_NOTIFICATION_TITLE =
    apptileConfig.app_name || 'Apptile Seed';
  await removeForceUnlinkForNativePackage(
    'react-native-klaviyo',
    extraModules,
    parsedReactNativeConfig,
  );
  await removeForceUnlinkForNativePackage(
    '@react-native-community/push-notification-ios',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeKlaviyo(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  imageNotificationPlist.APPTILE_DEFAULT_NOTIFICATION_TITLE = 'Apptile';
  await addForceUnlinkForNativePackage(
    'react-native-klaviyo',
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
  const appsflyerIntegration = apptileConfig.integrations.appsflyer;
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
  infoPlist.APPSFLYER_DEVKEY = 'xxx';
  infoPlist.APPSFLYER_APPID = 'xxx';

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
  const metaIntegration = apptileConfig.integrations.metaAds;
  infoPlist.FacebookAppID = metaIntegration.FacebookAppId;
  infoPlist.FacebookClientToken = metaIntegration.FacebookClientToken;
  infoPlist.FacebookDisplayName = metaIntegration.FacebookDisplayName;
  infoPlist.FacebookAutoLogAppEventsEnabled =
    metaIntegration.FacebookAutoLogAppEventsEnabled;
  infoPlist.FacebookAdvertiserIDCollectionEnabled =
    metaIntegration.FacebookAdvertiserIDCollectionEnabled;
  removeForceUnlinkForNativePackage(
    'react-native-fbsdk-next',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeFacebook(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  infoPlist.FacebookAppID = 'xxx';
  infoPlist.FacebookClientToken = 'xxx';
  infoPlist.FacebookDisplayName = 'xxx';
  infoPlist.FacebookAutoLogAppEventsEnabled = 'xxx';
  infoPlist.FacebookAdvertiserIDCollectionEnabled = 'xxx';
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
  const onesignalIntegration = apptileConfig.integrations.oneSignal;
  infoPlist.ONESIGNAL_APPID = onesignalIntegration.onesignal_app_id;
  removeForceUnlinkForNativePackage(
    'react-native-onesignal',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeOnesignal(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  infoPlist.ONESIGNAL_APPID = 'xxx';
  addForceUnlinkForNativePackage(
    'react-native-onesignal',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function addZego(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  apptileConfig,
  parsedReactNativeConfig,
  extraModules,
) {
  infoPlist.NSCameraUsageDescription = 'Access camera for live streaming';
  infoPlist.NSLocationWhenInUseUsageDescription = '';
  infoPlist.NSMicrophoneUsageDescription = 'Microphone for Live Streaming';
  infoPlist.NSUserTrackingUsageDescription =
    'Your privacy matters. We collect usage data to enhance your app experience. Rest assured, your information is handled securely and used solely for improvement';

  await removeForceUnlinkForNativePackage(
    'zego-express-engine-reactnative',
    extraModules,
    parsedReactNativeConfig,
  );
}

async function removeZego(
  infoPlist,
  imageNotificationPlist,
  notificationContentInfoPlist,
  extraModules,
  parsedReactNativeConfig,
) {
  await addForceUnlinkForNativePackage(
    'zego-express-engine-reactnative',
    extraModules,
    parsedReactNativeConfig,
  );
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
        path.resolve(
          apptileConfig.SDK_PATH,
          'packages/apptile-app/devops/scripts/ios/iconset-generator.sh',
        ),
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

    const bundle_id =
      apptileConfig.ios?.bundle_id || 'com.apptile.apptilepreviewdemo';

    apptileSeedEntitlements['com.apple.security.application-groups'] = [
      `group.${bundle_id}.notification`,
    ];
    imageNotificationEntitlements['com.apple.security.application-groups'] = [
      `group.${bundle_id}.notification`,
    ];

    await updateAppleTeamID(
      apptileConfig.ios?.team_id,
      path.resolve(__dirname),
    );

    // For facebook analytics
    const parsedReactNativeConfig = await readReactNativeConfigJs();
    if (apptileConfig.feature_flags?.ENABLE_FBSDK) {
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
    if (apptileConfig.feature_flags?.ENABLE_CLEVERTAP) {
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
    if (apptileConfig.feature_flags?.ENABLE_APPSFLYER) {
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
    if (apptileConfig.feature_flags?.ENABLE_MOENGAGE) {
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
    if (apptileConfig.feature_flags?.ENABLE_ONESIGNAL) {
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
    if (apptileConfig.feature_flags?.ENABLE_KLAVIYO) {
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

    // For zego live streaming
    if (apptileConfig.feature_flags?.ENABLE_LIVELY) {
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
      const manifestUrl = `${apptileConfig.APPTILE_BACKEND_URL}/api/v2/app/${apptileConfig.APP_ID}/manifest`;
      console.log('Downloading manifest from ' + manifestUrl);
      const {data: manifest} = await axios.get(manifestUrl);
      const publishedCommit = manifest.forks[0].publishedCommitId;
      const iosBundle = manifest.codeArtefacts.find(
        it => it.type === 'ios-jsbundle',
      );

      if (publishedCommit) {
        const appConfigUrl = `${apptileConfig.APPCONFIG_SERVER_URL}/${apptileConfig.APP_ID}/main/main/${publishedCommit}.json`;
        console.log('Downloading appConfig from: ' + appConfigUrl);
        const appConfigPath = path.resolve(__dirname, 'ios/appConfig.json');
        await downloadFile(appConfigUrl, appConfigPath);
        console.log('appConfig downloaded');
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
      console.error('Failed to download appconfig');
      await writeFile(
        bundleTrackerPath,
        `{"publishedCommitId": null, "iosBundleId": null}`,
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
  } catch (err) {
    console.error('Uncaught exception in iosProjectSetup: ', err);
    process.exit(1);
  }
}

main();
