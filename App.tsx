import React, {useEffect} from 'react';
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
import {NativeModules} from 'react-native';
const {RNApptile} = NativeModules;

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

export default App;
