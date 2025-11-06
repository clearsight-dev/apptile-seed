# Project Overview

This is the **apptile-seed** project, a React Native 0.73.8 application that serves as the runtime environment for the Apptile no-code platform.

## Platform Details

- **Platform**: React Native 0.73.8 with TypeScript support
- **Purpose**: Mobile app builder runtime for the Apptile no-code platform (https://app.apptile.io)
- **Plugin System**: Custom React Native components stored in `remoteCode/` directory
- **SDK**: External apptile-core package provides hooks and utilities

## Directory Structure

```
remoteCode/
├── index.js              # Auto-generated plugin initialization (DO NOT EDIT)
├── indexNav.js           # Auto-generated navigator initialization (DO NOT EDIT)
├── plugins/              # Custom widget plugins go here
│   └── something/        # Example plugin
│       ├── metadata.json
│       └── source/
│           ├── component.jsx  # Main editable file - all code goes here
│           └── widget.jsx     # Auto-generated wrapper (DO NOT EDIT)
└── navigators/           # Custom navigators go here
    └── testnav/          # Example bottom tab navigator
        ├── metadata.json
        └── source/
            └── index.jsx      # Navigator implementation
```

## Supported Libraries

You can ONLY import from these libraries:
- `react`
- `react-native`
- `react-redux`
- `@gorhom/portal`
- `react-native-svg`
- `graphql-tag`
- `react-native-gesture-handler` (version 2)
- `react-native-webview` (version 13)
- `apptile-core`
- `apptile-shopify`
- `@react-navigation/native`
- `moment`
- `lodash`

**DO NOT** use any other libraries, including Expo libraries.

## Build and Development

### Running the App
```bash
# iOS
npm run ios

# Android
npm run android

# Start Metro bundler
npm start
```

### Project Setup
The project uses setup scripts that auto-generate configuration files:
- `iosProjectSetup.js` - iOS configuration
- `androidProjectSetup.js` - Android configuration
- `commonProjectSetup.js` - Shared configuration

These scripts generate:
- `remoteCode/index.js` - Plugin initialization
- `remoteCode/indexNav.js` - Navigator initialization
- `analytics/index.ts` - Analytics configuration
- `extra_modules.json` - Metro bundler module resolution

**DO NOT** manually edit these generated files.

## Additional Resources

- Apptile Platform: https://app.apptile.io
- Full Documentation: http://127.0.0.1:5500/systemPrompts/latest.html (local dev server)
- Supported Icon Libraries: Material Icons, MaterialCommunityIcons, FontAwesome5, AntDesign, Entypo, Feather, Ionicons, and more

