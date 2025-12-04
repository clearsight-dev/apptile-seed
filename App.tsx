import React, {useEffect} from 'react';
import {NativeModules, StyleSheet, View} from 'react-native';
// import {NativeModules} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {
  apptileNavigationRef,
  ApptileWrapper,
  ApptileAppRoot,
  useStartApptile,
} from 'apptile-core';

import JSSplash, {hideJSSplashScreen} from './components/JSSplash';
import UpdateModal from './components/UpdateModal';
import AdminPage from './components/AdminPage';
import BuildInfo from './components/BuildInfo';
// import FloatingUpdateModal from './components/FloatingUpdateModal';
const {RNApptile} = NativeModules;
export type ScreenParams = {
  NocodeRoot: undefined;
  NativeUtils: {appId: string};
  AdminPage: {appId: string};
  BuildInfo: undefined;
};

// Import the generated code. The folder analytics is generated when you run the app.
import {init as initAnalytics} from './analytics';
// Import the generated splash config
import {SPLASH_FILE_NAME, IS_SPLASH_GIF} from './config/splashConfig';

const Stack = createNativeStackNavigator<ScreenParams>();

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

function App(): React.JSX.Element {
  const status = useStartApptile(initAnalytics, true);
  useEffect(() => {
    RNApptile.notifyJSReady();
  }, []);

  // Hide splash screen when model is ready
  useEffect(() => {
    if (status.modelReady) {
      hideJSSplashScreen();
    }
  }, [status.modelReady]);

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
    </ApptileWrapper>
  );
}

// Helper function to dynamically require the splash image
const getSplashImageSource = () => {
  // Use the generated splash file name
  // Note: React Native requires static paths for require(), so we use a switch statement
  switch (SPLASH_FILE_NAME) {
    case 'splash.gif':
      return require('./assets/splash.gif');
    case 'splash.png':
      return require('./assets/splash.png');
    case 'splash.jpg':
      return require('./assets/splash.jpg');
    case 'splash.jpeg':
      return require('./assets/splash.jpeg');
    default:
      // Fallback to icon.png if splash file doesn't match expected names
      console.warn(`Unexpected splash file name: ${SPLASH_FILE_NAME}, using icon.png as fallback`);
      return require('./assets/icon.png');
  }
};

let AppWithJSSplash: React.FC<Record<string, any>> = props => (
  <JSSplash
    splashImageSource={getSplashImageSource()}
    isGif={IS_SPLASH_GIF}
  >
    <View style={styles.container}>
      <App {...props} />
    </View>
  </JSSplash>
);

export default AppWithJSSplash;
