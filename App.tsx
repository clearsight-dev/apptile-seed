import React, {useEffect, useState} from 'react';
import {NativeModules, View, Image, StyleSheet, Platform} from 'react-native';
// import {NativeModules} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {
  apptileNavigationRef,
  ApptileWrapper,
  ApptileAppRoot,
  useStartApptile,
} from 'apptile-core';

// import JSSplash from './components/JSSplash';
import UpdateModal from './components/UpdateModal';
import AdminPage from './components/AdminPage';
import BuildInfo from './components/BuildInfo';
// import FloatingUpdateModal from './components/FloatingUpdateModal';
const {RNApptile} = NativeModules;

// Import config to read splash settings
const apptileConfig = require('./apptile.config.json');
export type ScreenParams = {
  NocodeRoot: undefined;
  NativeUtils: {appId: string};
  AdminPage: {appId: string};
  BuildInfo: undefined;
};

// Import the generated code. The folder analytics is generated when you run the app.
import {init as initAnalytics} from './analytics';

const Stack = createNativeStackNavigator<ScreenParams>();

function App(): React.JSX.Element {
  const status = useStartApptile(initAnalytics, true);
  // JS splash only for iOS - Android uses native splash
  const [showSplash, setShowSplash] = useState(Platform.OS === 'ios');

  // Read splash configuration from apptile.config.json
  const gifSplashDuration = apptileConfig?.feature_flags?.GIF_SPLASH_DURATION ?? 1;

  // Determine splash duration (in milliseconds)
  const splashDuration = typeof gifSplashDuration === 'number' && gifSplashDuration > 0
    ? gifSplashDuration * 1000
    : 1000; // Default to 1 second

  // Determine which splash image to use based on file extension from config (iOS only)
  const getSplashSource = () => {
    if (Platform.OS !== 'ios') {
      return null;
    }
    const splashPath = apptileConfig?.ios?.splash_path;

    // Check if splash path ends with .gif
    const isGif = splashPath?.toLowerCase().endsWith('.gif');

    // Try to load the appropriate file, fallback to png if gif doesn't exist
    if (isGif) {
      try {
        return require('./assets/splash.gif');
      } catch (e) {
        console.warn('splash.gif not found, falling back to splash.png');
        return require('./assets/splash.png');
      }
    }
    return require('./assets/splash.png');
  };

  const splashSource = getSplashSource();

  useEffect(() => {
    RNApptile.notifyJSReady();
  }, []);

  // Hide splash screen after configured duration (iOS only)
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, splashDuration);

    return () => clearTimeout(timer);
  }, [splashDuration]);

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

  // The nocode layer will not do navigation to these screens so you can handle those navigations in the onNavigationEvent
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
      {showSplash && (
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
