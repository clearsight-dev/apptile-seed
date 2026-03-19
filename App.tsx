import React, {useEffect, useState} from 'react';
import {NativeModules, View, Image, StyleSheet, Platform, Alert} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {
  apptileNavigationRef,
  ApptileWrapper,
  ApptileAppRoot,
  useStartApptile,
  SentryHelper,
} from 'apptile-core';
import LogRocket from '@logrocket/react-native';

import UpdateModal from './components/UpdateModal';
import AdminPage from './components/AdminPage';
import BuildInfo from './components/BuildInfo';
const {RNApptile} = NativeModules;

const apptileConfig = require('./apptile.config.json');
export type ScreenParams = {
  NocodeRoot: undefined;
  NativeUtils: {appId: string};
  AdminPage: {appId: string};
  BuildInfo: undefined;
};

import {init as initAnalytics} from './analytics';

const Stack = createNativeStackNavigator<ScreenParams>();

function App(): React.JSX.Element {
  const status = useStartApptile(initAnalytics, true);

  const splashPath = apptileConfig?.ios?.splash_path;
  const isGifSplash =
    Platform.OS === 'ios' && splashPath?.toLowerCase().endsWith('.gif');

  const [showSplash, setShowSplash] = useState(isGifSplash);

  const gifSplashDuration =
    apptileConfig?.feature_flags?.GIF_SPLASH_DURATION ?? 1;
  const splashDuration =
    typeof gifSplashDuration === 'number' && gifSplashDuration > 0
      ? gifSplashDuration * 1000
      : 1000;

  const getSplashSource = () => {
    try {
      return require('./assets/splash.gif');
    } catch (e) {
      console.warn('splash.gif not found');
      return null;
    }
  };

  const splashSource = getSplashSource();

  useEffect(() => {
    SentryHelper.init();
    if (apptileConfig?.feature_flags?.ENABLE_LOGROCKET) {
      LogRocket.init(
        apptileConfig?.integrations?.logrocket?.id ||
          '97heiy/mobile-apps-ur1xt',
        {
          network: {
            requestSanitizer: request => {
              if (request?.headers['x-auth-token']) {
                request.headers['x-auth-token'] = '';
              }
              return request;
            },
          },
          console: {
            isEnabled: {
              warn: false,
            },
            shouldAggregateConsoleErrors: true,
          },
          redactionTags: ['RedactionString'],
        },
      );
    }
  }, []);

  useEffect(() => {
    RNApptile.notifyJSReady();
  }, []);

  useEffect(() => {
    if (!isGifSplash) {
      return;
    }
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, splashDuration);

    return () => clearTimeout(timer);
  }, [splashDuration, isGifSplash]);

  useEffect(() => {
    Alert.alert('New Code push through build');
  }, []);

  let body = (
    <NavigationContainer
      ref={apptileNavigationRef}
      theme={{
        ...DefaultTheme,
        colors: status.theme,
      }}
      linking={status.linking}
      onReady={() => {
        RNApptile.notifyJSReady();
      }}>
      <Stack.Navigator
        screenOptions={{
          animation: 'none',
        }}>
        <Stack.Screen
          name="NocodeRoot"
          component={ApptileAppRoot}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="NativeUtils"
          component={UpdateModal}
          options={{headerShown: true}}
          initialParams={{appId: status.appId}}
        />
        <Stack.Screen
          name="AdminPage"
          component={AdminPage}
          options={{headerShown: true}}
          initialParams={{appId: status.appId}}
        />
        <Stack.Screen
          name="BuildInfo"
          component={BuildInfo}
          options={{headerShown: true}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );

  return (
    <ApptileWrapper
      noNavigatePaths={['NativeUtils', 'AdminPage', 'BuildInfo']}
      onNavigationEvent={ev => {
        console.log('handle navigation event', ev);
        apptileNavigationRef.current.navigate(ev.screenName, {
          appId: status.appId,
        });
      }}>
      {body}
      {showSplash && splashSource && (
        <View style={styles.splashContainer}>
          <Image
            source={splashSource}
            style={styles.splashImage}
            resizeMode="cover"
          />
        </View>
      )}
    </ApptileWrapper>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 9999,
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
});

export default App;
