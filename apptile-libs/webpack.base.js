const path = require("path");
const fs = require("fs");

function constructExternals(extra = []) {
  const libs = [
    "@segment/analytics-react-native",
    "@gorhom/portal",
    "react",
    "lodash",
    "lodash-es",
    "immutable",
    "@apollo/client",
    "react-redux",
    "redux",
    "redux-saga",
    "redux-saga/effects",
    "reselect",
    "react-dnd",
    "react-dnd-html5-backend",
    "rn-dynamic-fonts",
    "react-native-safe-area-context",
    "react-native",
    "react-native-vector-icons",
    "react-native-gesture-handler",
    "react-native-reanimated",
    "react-native-svg",
    "@react-navigation/bottom-tabs",
    "@react-navigation/drawer",
    "@react-navigation/native",
    "@react-navigation/native-stack",
    "@react-navigation/stack",
    "jsan",
    "moment",
    "graphql",
    "react-dom",
    "react-native-web",
    "redux-logger",
    "tinycolor2",
    "react-native-device-info",
    "react-native-haptic-feedback",
    "react-native-keyboard-aware-scroll-view",
    "react-native-toast-notifications",
    "rn-fetch-blob",
    "validate-color",
    "@babel/polyfill",
    "@babel/runtime",
    "@react-native-async-storage/async-storage",
    "@react-native-clipboard/clipboard",
    "@react-native-firebase/messaging",
    "@sentry/core",
    "@sentry/react-native",
    "acorn-walk",
    "axios",
    "babel-plugin-module-resolver",
    "babel-plugin-transform-inline-environment-variables",
    "immutability-helper",
    "logrocket",
    "react-native-keyboard-controller",
    "react-native-appsflyer",
    "react-native-zip-archive",
    "react-native-permissions",
    "react-native-fast-image",
    "react-native-fbsdk-next",
    "react-native-webview",
    "react-native-moengage",
    "react-native-onesignal",
    "lottie-react-native",
    "@react-native-firebase/analytics",
    "@native-html/iframe-plugin",
    "react-native-render-html",
    "validator",
    "srcset",
    "klaviyo-react-native-sdk",
    "react-native-push-notification",
    "@react-native-community/push-notification-ios",
    "@react-navigation/material-top-tabs",
    "apollo3-cache-persist",
    "htmlparser2",
    "clevertap-react-native",
    "asset_placeholder-image",
    "asset_auction-crown",
    "asset_auction-gavel",
    "asset_auction-stars",
    "asset_gold-flare",
    "tslib",
    ...extra,
  ];

  return libs.reduce((externals, libName) => {
    let externalName = libName;
    externals[libName] = {
      commonjs: externalName,
      commonjs2: externalName,
      amd: externalName,
      umd: externalName,
    };

    return externals;
  }, {});
}

function constructExternalsWithSubpaths(baseExternals = {}) {
  const externals = { ...baseExternals };
  const subpathExternals = [];

  for (const pkg of Object.keys(baseExternals)) {
    // Skip if it's a webpack regex already
    if (pkg instanceof RegExp) continue;

    try {
      // Escape special characters in package names for regex
      const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      subpathExternals.push(new RegExp(`^${escaped}/.+$`));
    } catch (e) {
      console.warn(`Failed to create regex for package: ${pkg}`, e);
    }
  }

  return {
    externalsObject: externals,
    externalsRegexes: subpathExternals,
  };
}

module.exports = ({ entryFile, outputDir, externals = [] }) => {
  fs.mkdirSync(outputDir, { recursive: true });

  const { externalsObject, externalsRegexes } = constructExternalsWithSubpaths(
    constructExternals(externals)
  );

  return {
    entry: {
      "index.mobile": entryFile,
    },
    output: {
      path: outputDir,
      filename: "[name].js",
      library: {
        type: "commonjs2",
      },
    },
    mode: "production",
    devtool: false,
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css"],
    },
    externals: [externalsObject, ...externalsRegexes],
    optimization: {
      usedExports: true,
      minimize: true,
    },
    module: {
      rules: [
        {
          test: /.(ts|tsx|js|jsx)$/,
          use: {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              cacheCompression: false,
              presets: ["module:@react-native/babel-preset"], //['module:@react-native/babel-preset', { enableBabelRuntime: false} ]]
            },
          },
        },
        {
          test: /\.(ttf|otf|eot|woff|woff2)$/,
          use: {
            loader: "url-loader",
          },
          include: [
            path.join(__dirname, "node_modules", "react-native-vector-icons"),
          ],
        },
        {
          type: "asset/resource",
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
        },
      ],
    },
  };
};
