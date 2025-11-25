import React from 'react';
import {Platform} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createScreenFromConfig, createNavigatorsFromConfig} from 'apptile-core';

const BottomTabNavigator = createBottomTabNavigator();

export default function createBottomTabNavigatorFromConfig(
  navigatorConfig,
  navigatorModel,
  props = {},
  pages,
){
  let navigatorOptions = {
    screenOptions: {
      tabBarLabelPosition: 'below-icon',
    },
  };

  if (Platform.OS !== 'web') navigatorOptions = {...navigatorOptions, detachInactiveScreens: false};

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
              options={{headerShown: false}}>
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
};
