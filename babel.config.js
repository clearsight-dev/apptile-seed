module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '@/root': './',
        },
      },
    ],
    'transform-inline-environment-variables',
    '@babel/plugin-transform-export-namespace-from'
  ]
};
