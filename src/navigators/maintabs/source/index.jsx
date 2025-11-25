import React from 'react';
import {Platform} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createScreenFromConfig, createNavigatorsFromConfig, Icon} from 'apptile-core';

const BottomTabNavigator = createBottomTabNavigator();

const getTabBarIcon = config => {
  return ({color, size}) => {
    const screenName = config?.name?.toLowerCase() || '';

    if (screenName === 'home') {
      return (
        <Icon
          iconType={'MaterialIcons'}
          name={'map'}
          size={size}
          color={color}
        />
      );
    }
    if (screenName === 'leaderboard') {
      return (
        <Icon
          iconType={'MaterialIcons'}
          name={'leaderboard'}
          size={size}
          color={color}
        />
      );
    }

    return (
      <Icon
        iconType={config?.iconType || 'MaterialIcons'}
        name={config?.iconName || 'home'}
        size={size}
        color={color}
      />
    );
  };
};

export default function createBottomTabNavigatorFromConfig(
  navigatorConfig,
  navigatorModel,
  props = {},
  pages,
) {
  let navigatorOptions = {
    screenOptions: {
      tabBarLabelPosition: 'below-icon',
      tabBarActiveTintColor: '#501F16',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        height: Platform.OS === 'ios' ? 70 : 60,
        paddingBottom: Platform.OS === 'ios' ? 22 : 8,
        paddingTop: Platform.OS === 'ios' ? 10 : 8,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
      },
      headerShown: false,
    },
  };

  if (Platform.OS !== 'web') {
    navigatorOptions = {...navigatorOptions, detachInactiveScreens: false};
  }

  return (
    <BottomTabNavigator.Navigator
      id={navigatorConfig.name}
      {...navigatorOptions}
      {...props}>
      {navigatorConfig.screens
        .map(config => {
          const screenModel = navigatorModel?.screens?.[config.name];
          const iconGenerator = getTabBarIcon(config);

          return config.type === 'navigator' ? (
            <BottomTabNavigator.Screen
              name={config.name}
              key={config.name}
              navigationKey={config.name}
              options={{headerShown: false, tabBarIcon: iconGenerator}}>
              {screenProps =>
                createNavigatorsFromConfig(
                  config,
                  screenModel,
                  screenProps,
                  pages,
                )
              }
            </BottomTabNavigator.Screen>
          ) : (
            createScreenFromConfig(
              BottomTabNavigator,
              config,
              screenModel,
              pages,
            )
          );
        })
        .toList()
        .toJS()}
    </BottomTabNavigator.Navigator>
  );
}