# Creating Navigators

Navigators define the navigation structure of the app (e.g., bottom tabs, stack navigation).

## File Structure

```
remoteCode/navigators/<navigator-name>/
├── metadata.json
└── source/
    └── index.jsx
```

## metadata.json

```json
{
  "editableFilePath": "source/index.jsx",
  "entry": "source/index.jsx"
}
```

## Bottom Tab Navigator Example

```javascript
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createScreenFromConfig, createNavigatorsFromConfig } from 'apptile-core';

const BottomTabNavigator = createBottomTabNavigator();

export default function createBottomTabNavigatorFromConfig(
  navigatorConfig,
  navigatorModel,
  props = {},
  pages
) {
  let navigatorOptions = {
    screenOptions: {
      tabBarLabelPosition: 'below-icon',
    },
  };

  if (Platform.OS !== 'web') {
    navigatorOptions = { ...navigatorOptions, detachInactiveScreens: false };
  }

  return (
    <BottomTabNavigator.Navigator 
      id={navigatorConfig.name} 
      {...navigatorOptions} 
      {...props}
    >
      {navigatorConfig.screens
        .map(config => {
          const screenModel = navigatorModel?.screens[config.name];
          return config.type === 'navigator' ? (
            <BottomTabNavigator.Screen
              name={config.name}
              key={config.name}
              navigationKey={config.name}
              options={{ headerShown: false }}
            >
              {screenProps => createNavigatorsFromConfig(config, screenModel, screenProps, pages)}
            </BottomTabNavigator.Screen>
          ) : (
            createScreenFromConfig(BottomTabNavigator, config, screenModel, pages)
          );
        })
        .toList()
        .toJS()}
    </BottomTabNavigator.Navigator>
  );
}
```

## Stack Navigator Example

```javascript
import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createScreenFromConfig, createNavigatorsFromConfig } from 'apptile-core';

const StackNavigator = createStackNavigator();

export default function createStackNavigatorFromConfig(
  navigatorConfig,
  navigatorModel,
  props = {},
  pages
) {
  let navigatorOptions = {
    screenOptions: {
      headerShown: false,
    },
  };

  if (Platform.OS !== 'web') {
    navigatorOptions = { ...navigatorOptions, detachInactiveScreens: false };
  }

  return (
    <StackNavigator.Navigator 
      id={navigatorConfig.name} 
      {...navigatorOptions} 
      {...props}
    >
      {navigatorConfig.screens
        .map(config => {
          const screenModel = navigatorModel?.screens[config.name];
          return config.type === 'navigator' ? (
            <StackNavigator.Screen
              name={config.name}
              key={config.name}
              navigationKey={config.name}
              options={{ headerShown: false }}
            >
              {screenProps => createNavigatorsFromConfig(config, screenModel, screenProps, pages)}
            </StackNavigator.Screen>
          ) : (
            createScreenFromConfig(StackNavigator, config, screenModel, pages)
          );
        })
        .toList()
        .toJS()}
    </StackNavigator.Navigator>
  );
}
```

## Key Points

1. **Export a default function** that creates the navigator
2. **Use apptile-core helpers**: `createScreenFromConfig` and `createNavigatorsFromConfig`
3. **Handle nested navigators**: Check if `config.type === 'navigator'`
4. **Platform-specific options**: Use `Platform.OS` to customize behavior
5. **Immutable.js**: Use `.toList().toJS()` to convert Immutable data structures

## Example Navigator

See `remoteCode/navigators/testnav/source/index.jsx` for a working bottom tab navigator example.

