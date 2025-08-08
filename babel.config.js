module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'transform-inline-environment-variables',
    '@babel/plugin-transform-export-namespace-from'
  ]
};
