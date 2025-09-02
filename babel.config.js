module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'transform-inline-environment-variables',
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-transform-export-namespace-from',
  ],
};
