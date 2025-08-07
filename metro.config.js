const chalk = require('chalk')
const path = require('path');
const fs = require('fs');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const metroResolver = require('metro-resolver');
require("dotenv/config");

console.log(chalk.yellow(`
=====================================================
start with: metro.config.js
=====================================================
IS_EC2=${process.env.IS_EC2}
`));

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfigs = getDefaultConfig(__dirname);
const text = fs.readFileSync(path.resolve(__dirname, "apptile.config.json"), {encoding: "utf8"});
// let rootPath = path.resolve(__dirname, `../ReactNativeTSProjeect/packages`);
let rootPath = JSON.parse(text).SDK_PATH;

let rawExtraModules;

try {
  rawExtraModules = fs.readFileSync(
    path.resolve(__dirname, 'extra_modules.json'),
    {encoding: 'utf8'}
  );
} catch(err) {
  console.error(chalk.red('Extra_modules.json was not found! To generate it run the app from xcode or android studio once, then start metro'));
  throw err;
}

const extraModules = JSON.parse(rawExtraModules);

const watchPaths = Object.keys(
  extraModules.reduce((pathObj, modObj) => {
    pathObj[modObj.watchPath] = 1;
    return pathObj;
  }, {})
);

console.log("sdk path: " + rootPath);
const sourceExts = defaultConfigs.resolver.sourceExts;
const config = {
  resolver: {
    sourceExts: [...sourceExts, 'css', 'pcss', 'cjs'],
    resolveRequest: (context, moduleName, platform) => {
      let result = null;
      for (let i = 0; i < extraModules.length; ++i) {
        const mod = extraModules[i];
        if (mod.name === moduleName) {
          result = {
            [mod.returnKey]: mod.path,
            type: mod.returnType
          };
          break;
        }
      }

      if (moduleName.startsWith("@/root/app/assets/")) {
        const filePath = moduleName.substring("@/root/app/assets/".length)
        result = {
          filePaths: [path.resolve(rootPath, "packages/apptile-app/app/assets", filePath)],
          type: "assetFiles"
        }
        // console.log("Resolving: ", moduleName, result);
      }

      if (result) {
        // console.log(result);
        return result;
      } else {
        return metroResolver.resolve({ ...context, resolveRequest: null }, moduleName, platform);
      }
    },
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')]
  },
  watchFolders: [
    path.resolve(__dirname, './node_modules'),
    ...watchPaths
  ],
};

module.exports = mergeConfig(defaultConfigs, config);
