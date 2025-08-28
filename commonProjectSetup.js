const chalk = require('chalk');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const xcode = require('xcode');
const plist = require('plist');
const {createWriteStream} = require('fs');
const {
  readFile,
  writeFile,
  readdir,
  rmdir,
  mkdir,
  cp,
} = require('node:fs/promises');

async function downloadFile(url, destination) {
  const outputPath = destination;
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

    const writer = createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (err) {
    console.error('Failed to download asset to: ', destination);
    throw err;
  }
}

async function downloadFileToAssets(url, fileName) {
  return downloadFile(url, path.resolve(__dirname, 'assets', fileName));
}

const analyticsTemplate = `// This file is generated at build time based on the integrations added to the app
import {Platform} from 'react-native';
import {checkATTPermission, ApptileAnalytics, addCustomEventListener} from 'apptile-core';
import {
  Firebase as FirebaseAnalytics,
  // __ENABLED_ANALYTICS_IMPORTS__
} from 'apptile-core';

import {
  initStoreWithRootSagas,
} from 'apptile-core';

import { loadDatasourcePlugins } from 'apptile-datasource';
import { initPlugins } from 'apptile-plugins';
// __EXTRA_LEGACY_PLUGIN_IMPORTS__

import { initNavs } from '../remoteCode/indexNav';
import { initPlugins as initRemotePlugins } from '../remoteCode';

initStoreWithRootSagas();
loadDatasourcePlugins();
initPlugins();
initRemotePlugins();
initNavs();

// The plugins initialized here will not be available in the web
// as an addon. This is only meant for toggling exsiting plugins which
// are tightly integrated with apptile-core. Use remoteCode folder for
// everything else
// __EXTRA_LEGACY_INITIALIZERS__

export async function init() {
  if (Platform.OS === 'ios') {
    try {
      await checkATTPermission();
    } catch (err) {
      console.log('Failure in att check', err);
    }
  }

  try {
    await ApptileAnalytics.initialize([
      FirebaseAnalytics,
      // __ENABLED_ANALYTICS__
    ]);
  } catch (err) {
    console.error('Failure in initializing ApptileAnalytics');
  }
}

addCustomEventListener('ApptileAnalyticsSendEvent', (type, name, params) => {
  ApptileAnalytics.sendEvent(type, name, params);
});`;

async function generateAnalytics(
  analyticsTemplateRef,
  integrations,
  featureFlags,
) {
  integrations = integrations || {};
  let enabledAnalytics = '';
  if (featureFlags?.ENABLE_FBSDK) {
    analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
      /\/\/ __ENABLED_ANALYTICS_IMPORTS__/g,
      `Facebook as FacebookAnalytics,\n  \/\/ __ENABLED_ANALYTICS_IMPORTS__`,
    );
    enabledAnalytics += `FacebookAnalytics,\n      `;
  }

  if (featureFlags?.ENABLE_APPSFLYER) {
    analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
      /\/\/ __ENABLED_ANALYTICS_IMPORTS__/g,
      `AppsFlyer as AppsFlyerAnalytics,\n  \/\/ __ENABLED_ANALYTICS_IMPORTS__`,
    );
    enabledAnalytics += `AppsFlyerAnalytics,\n      `;
  }

  if (featureFlags?.ENABLE_MOENGAGE) {
    // Update analytics file
    analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
      /\/\/ __ENABLED_ANALYTICS_IMPORTS__/g,
      `Moengage as MoengageAnalytics,\n  \/\/ __ENABLED_ANALYTICS_IMPORTS__`,
    );
    enabledAnalytics += `MoengageAnalytics,\n      `;
  }

  if (featureFlags?.ENABLE_ONESIGNAL) {
    // Update analytics file
    analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
      /\/\/ __ENABLED_ANALYTICS_IMPORTS__/g,
      `OneSignal as OneSignalAnalytics,\n  \/\/ __ENABLED_ANALYTICS_IMPORTS__`,
    );
    enabledAnalytics += `OneSignalAnalytics,\n      `;
  }

  if (featureFlags?.ENABLE_CLEVERTAP) {
    // Update analytics file
    analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
      /\/\/ __ENABLED_ANALYTICS_IMPORTS__/g,
      `CleverTap as CleverTapAnalytics,\n  \/\/ __ENABLED_ANALYTICS_IMPORTS__`,
    );
    enabledAnalytics += `CleverTapAnalytics,\n      `;
  }
  enabledAnalytics += `// __ENABLED_ANALYTICS__`;

  analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
    /\/\/ __ENABLED_ANALYTICS__/g,
    enabledAnalytics,
  );
  if (integrations.shopify) {
    analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
      /\/\/ __EXTRA_LEGACY_INITIALIZERS__/,
      `loadShopifyPlugins();\n// __EXTRA_LEGACY_INITIALIZERS__`,
    );
    analyticsTemplateRef.current = analyticsTemplateRef.current.replace(
      /\/\/ __EXTRA_LEGACY_PLUGIN_IMPORTS__/,
      `import { loadDatasourcePlugins as loadShopifyPlugins } from 'apptile-shopify';\n// __EXTRA_LEGACY_PLUGIN_IMPORTS__`,
    );
  }
  return writeFile(
    path.resolve(__dirname, 'analytics/index.ts'),
    analyticsTemplateRef.current,
  );
}

const packageStubs = {
  'react-native-fbsdk-next': `
export const AppEventsLogger = {
  AppEventParams: {
    AppEventParams: {},
    Content: {},
    Currency: {},
    NumItems: {},
    SearchString: {},
    ContentID: {}
  },
  AppEvents: {
    AddedToCart: {},
    InitiatedCheckout: {},
    Purchased: {},
    Searched: {},
    ViewedContent: {},
    AddedToWishlist: {}
  },
  logEvent: () => console.log('subbed facebook logEvent')
};
export default {};
`,
  'react-native-moengage': `
export const MoEProperties = {};
export const MoEInitConfig = {};
export const MoEPushConfig = {};
export const MoEngageLogConfig = {};
export const MoEngageLogLevel = {};
export const MoEAppStatus = {};
export const Platform = {};
export default {}`,

  'react-native-appsflyer': `export default {
onDeepLink: () => console.log('stubbed appsflyer onDeeplink')
};`,
  'react-native-onesignal': `export default {};`,
  'clevertap-react-native': `export default {}`,
  'react-native-klaviyo': `export default {};`,
  '@react-native-community/push-notification-ios': 'export default {}',
  'zego-express-engine-reactnative': `export default {};`,
};

async function addForceUnlinkForNativePackage(
  packageName,
  extraModules,
  parsedReactNativeConfig,
) {
  // add unlinker in react-native.config.js
  parsedReactNativeConfig.dependencies[packageName] = {
    platforms: {
      android: null,
      ios: null,
    },
  };

  // remove stub file if exists
  let exists = false;
  try {
    const entries = await readdir(path.resolve(__dirname, 'stubs'), {
      withFileTypes: true,
    });
    for (let i = 0; i < entries.length; ++i) {
      if (entries[i].isDirectory() && entries[i].name === packageName) {
        exists = true;
        break;
      }
    }
  } catch (err) {
    if (err?.code === 'ENOENT') {
      exists = false;
    } else {
      throw err;
    }
  }

  if (!exists) {
    await mkdir(path.resolve(__dirname, `stubs/${packageName}`), {
      recursive: true,
    });

    // Use a default stub if the package doesn't have a specific one defined
    const stubContent =
      packageStubs[packageName] ||
      `export default {}; // Default stub for ${packageName}`;

    await writeFile(
      path.resolve(__dirname, `stubs/${packageName}/index.ts`),
      stubContent,
    );
  }

  // update metro.config.js
  const existing = extraModules.current.find(it => it.name == packageName);
  if (!existing) {
    extraModules.current.push({
      name: packageName,
      path: path.resolve(__dirname, `stubs/${packageName}/index.ts`),
      watchPath: path.resolve(__dirname, 'stubs'),
      returnKey: 'filePath',
      returnType: 'sourceFile',
    });
  }
}

async function removeForceUnlinkForNativePackage(
  packageName,
  extraModules,
  parsedReactNativeConfig,
) {
  // remove unlinker from react-native.config.js
  if (parsedReactNativeConfig.dependencies[packageName]) {
    delete parsedReactNativeConfig.dependencies[packageName];
  }

  // remove stub file if it exists
  let exists = false;
  try {
    const entries = await readdir(path.resolve(__dirname, 'stubs'), {
      withFileTypes: true,
    });
    for (let i = 0; i < entries.length; ++i) {
      if (entries[i].isDirectory() && entries[i].name === packageName) {
        exists = true;
        break;
      }
    }
  } catch (err) {
    if (err?.code === 'ENOENT') {
      exists = false;
    } else {
      throw err;
    }
  }

  if (exists) {
    await rmdir(path.resolve(__dirname, 'stubs', packageName), {
      recursive: true,
    });
  }

  //TODO:HANDLE THIS LOGIC IN A BETTER WAY.
  if (packageName !== 'zego-express-engine-reactnative') {
    extraModules.current = extraModules.current.filter(
      mod => mod.name !== packageName,
    );
  }
}

async function writeReactNativeConfigJs(parsedReactNativeConfig) {
  const updatedConfig = `module.exports = ${JSON.stringify(
    parsedReactNativeConfig,
    null,
    2,
  )}`;
  await writeFile(
    path.resolve(__dirname, 'react-native.config.js'),
    updatedConfig,
  );
}

async function readReactNativeConfigJs() {
  const contents = await readFile(
    path.resolve(__dirname, 'react-native.config.js'),
    {encoding: 'utf8'},
  );
  const parsable = contents.replace(/module.exports\s?=/, '');
  const parsedConfig = JSON.parse(parsable);
  return parsedConfig;
}

function getExtraModules(apptileConfig) {
  const extraModules = {
    SDK_PATH: apptileConfig.SDK_PATH,
    current: [
      {
        name: 'apptile-core',
        path: path.resolve(
          __dirname,
          'apptile-libs/dist/apptile-core/index.mobile.js',
          // 'packages/apptile-core/sdk.ts',
        ),
        watchPath: path.resolve(
          __dirname,
          'apptile-libs',
          // 'packages/apptile-core',
        ),
        returnKey: 'filePath',
        returnType: 'sourceFile',
      },
      {
        name: 'apptile-plugins',
        path: path.resolve(
          __dirname,
          'apptile-libs/dist/apptile-plugins/index.mobile.js',
          // 'packages/apptile-plugins/index.ts',
        ),
        watchPath: path.resolve(
          __dirname,
          'apptile-libs/dist/apptile-plugins',
          // 'packages/apptile-plugins',
        ),
        returnKey: 'filePath',
        returnType: 'sourceFile',
      },
      {
        name: 'asset_placeholder-image',
        path: [
          path.resolve(
            __dirname,
            'assets/image-placeholder.png',
          ),
        ],
        watchPath: path.resolve(
          __dirname,
        ),
        returnKey: 'filePaths',
        returnType: 'assetFiles',
      },
      {
        name: 'asset_auction-stars',
        path: [
          path.resolve(
            __dirname,
            'assets/auction-stars.png',
          ),
        ],
        watchPath: path.resolve(
          __dirname,
        ),
        returnKey: 'filePaths',
        returnType: 'assetFiles',
      },
      {
        name: 'asset_auction-crown',
        path: [
          path.resolve(
            __dirname,
            './assets/auction-crown.png',
          ),
        ],
        watchPath: path.resolve(
          __dirname,
        ),
        returnKey: 'filePaths',
        returnType: 'assetFiles',
      },
      {
        name: 'asset_auction-gavel',
        path: [
          path.resolve(
            __dirname,
            './assets/auction-gavel.png',
          ),
        ],
        watchPath: path.resolve(
          __dirname,
        ),
        returnKey: 'filePaths',
        returnType: 'assetFiles',
      },
      {
        name: 'asset_gold-flare',
        path: [
          path.resolve(
            __dirname,
            'assets/gold-flare.png',
          ),
        ],
        watchPath: path.resolve(
          __dirname,
        ),
        returnKey: 'filePaths',
        returnType: 'assetFiles',
      },
      {
        name: 'apptile-datasource',
        path: path.resolve(
          __dirname,
          'apptile-libs/dist/apptile-datasource/index.mobile.js',
          // 'packages/apptile-datasource/index.ts',
        ),
        watchPath: path.resolve(
          __dirname,
          'apptile-libs/dist/apptile-datasource',
          // 'packages/apptile-datasource',
        ),
        returnKey: 'filePath',
        returnType: 'sourceFile',
      },
      {
        name: 'apptile-shopify',
        path: path.resolve(
          __dirname,
          'apptile-libs/dist/apptile-shopify/index.mobile.js',
          // 'packages/apptile-shopify/index.ts',
        ),
        watchPath: path.resolve(
          __dirname,
          'apptile-libs/dist/apptile-shopify',
          // 'packages/apptile-shopify',
        ),
        returnKey: 'filePath',
        returnType: 'sourceFile',
      },
    ],
  };

  // Handle ENABLE_LIVELY_PIP for zego-express-engine-reactnative
  if (
    apptileConfig.feature_flags?.ENABLE_LIVELY &&
    apptileConfig.feature_flags?.ENABLE_LIVELY_PIP
  ) {
    // Use local copy when both ENABLE_LIVELY and ENABLE_LIVELY_PIP are true
    extraModules.current.push({
      name: 'zego-express-engine-reactnative',
      path: path.resolve(
        __dirname,
        'zego-express-engine-reactnative/lib/index.js',
      ),
      watchPath: path.resolve(__dirname, 'zego-express-engine-reactnative'),
      returnKey: 'filePath',
      returnType: 'sourceFile',
    });
  }
  // Note: When ENABLE_LIVELY is true but ENABLE_LIVELY_PIP is false,
  // zego uses node_modules (no entry in extraModules)
  // When ENABLE_LIVELY is false, zego uses stub (handled by addForceUnlinkForNativePackage)

  // Handle PIPActivityRoot based on ENABLE_LIVELY and ENABLE_LIVELY_PIP flags
  if (
    apptileConfig.feature_flags?.ENABLE_LIVELY &&
    apptileConfig.feature_flags?.ENABLE_LIVELY_PIP
  ) {
    // With PIP: Use PIPActivityRoot.tsx
    extraModules.current.push({
      name: 'PIPActivityRoot',
      path: path.resolve(__dirname, './PIPActivityRoot.tsx'),
      watchPath: path.resolve(__dirname),
      returnKey: 'filePath',
      returnType: 'sourceFile',
    });
  } else {
    // Without PIP: Use PIPActivityWithoutRoot.tsx
    extraModules.current.push({
      name: 'PIPActivityRoot',
      path: path.resolve(__dirname, './PIPActivityRootWithoutPIP.tsx'),
      watchPath: path.resolve(__dirname),
      returnKey: 'filePath',
      returnType: 'sourceFile',
    });
  }

  // Note: When ENABLE_LIVELY is false, PIPActivityRoot is not added to extraModules

  return extraModules;
}

async function downloadIconAndSplash(apptileConfig) {
  let result = true;
  apptileConfig.assets = apptileConfig.assets || [];
  for (let i = 0; i < apptileConfig.assets.length; ++i) {
    try {
      const asset = apptileConfig.assets[i];
      if (asset.assetClass === 'splash') {
        console.log('Downloading splash');
        await downloadFileToAssets(asset.url, asset.fileName);
        await cp(
          path.resolve(__dirname, 'assets', asset.fileName),
          path.resolve(__dirname, 'ios', asset.fileName),
        );
        await cp(
          path.resolve(__dirname, 'assets', asset.fileName),
          path.resolve(
            __dirname,
            'android',
            'app',
            'src',
            'main',
            'res',
            'drawable',
            asset.fileName,
          ),
        );
      } else if (asset.assetClass === 'icon') {
        console.log('Downloading icon');
        await downloadFileToAssets(asset.url, asset.fileName);
      }
    } catch (err) {
      console.error(
        chalk.red(
          'Failed to download asset ' + JSON.stringify(apptileConfig.assets[i]),
          null,
          2,
        ),
      );
      // console.error(err);
      result = false;
    }
  }
  return result;
}

async function updateAppleTeamID(teamID, basePath) {
  if (!teamID) return;

  const exportPlistPath = path.join(basePath, 'ExportOptions.plist');
  const pbxprojPath = path.join(
    basePath,
    'ios',
    'apptileSeed.xcodeproj',
    'project.pbxproj',
  );

  // Step 1: Update ExportOptions.plist
  if (fs.existsSync(exportPlistPath)) {
    try {
      const rawPlist = fs.readFileSync(exportPlistPath, 'utf8');
      const parsedPlist = plist.parse(rawPlist);

      parsedPlist.teamID = teamID;

      const updatedPlist = plist.build(parsedPlist);
      fs.writeFileSync(exportPlistPath, updatedPlist, 'utf8');

      console.log(` ExportOptions.plist updated with teamID = ${teamID}`);
    } catch (err) {
      console.error('Failed to update ExportOptions.plist:', err);
    }
  } else {
    console.warn(`ExportOptions.plist not found at: ${exportPlistPath}`);
  }

  // Step 2: Update DEVELOPMENT_TEAM in project.pbxproj
  if (fs.existsSync(pbxprojPath)) {
    try {
      const project = xcode.project(pbxprojPath);
      project.parseSync();

      // Update development team in build configs
      const configs = project.pbxXCBuildConfigurationSection();
      for (const config of Object.values(configs)) {
        if (config && config.buildSettings) {
          config.buildSettings.DEVELOPMENT_TEAM = teamID;
        }
      }

      fs.writeFileSync(pbxprojPath, project.writeSync());
      console.log(`project.pbxproj updated with DEVELOPMENT_TEAM = ${teamID}`);
    } catch (err) {
      console.error('Failed to update project.pbxproj:', err);
    }
  } else {
    console.warn(`project.pbxproj not found at: ${pbxprojPath}`);
  }
}

module.exports = {
  downloadFile,
  downloadFileToAssets,
  analyticsTemplate,
  generateAnalytics,
  removeForceUnlinkForNativePackage,
  addForceUnlinkForNativePackage,
  writeReactNativeConfigJs,
  readReactNativeConfigJs,
  getExtraModules,
  downloadIconAndSplash,
  updateAppleTeamID,
};
