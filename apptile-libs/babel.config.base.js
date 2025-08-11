// babel.config.base.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // This becomes confusing when using @/root in apptile-app vs other libraries
    // ['module-resolver', {
    //   alias: {
    //     '@/root': './',
    //   },
    // }],
    'transform-inline-environment-variables',
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    '@babel/plugin-proposal-export-namespace-from',
    ['@babel/plugin-transform-runtime', {
      helpers: true,
      regenerator: true,
    }],
    'react-native-reanimated/plugin',
  ],
};
