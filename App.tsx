import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  NativeModules,
  SafeAreaView,
  View,
} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {ScreenParams} from './screenParams';
import {HomePage} from './components/HomePage';
import {Scanner} from './components/Scanner';
import {ToastProvider} from 'react-native-toast-notifications';
import {initStoreWithRootSagas} from 'apptile-core';

import {loadDatasourcePlugins} from 'apptile-datasource';
import {initPlugins} from 'apptile-plugins';

import {initNavs} from './remoteCode/indexNav';
import {initPlugins as initRemotePlugins} from './remoteCode';

initStoreWithRootSagas();
loadDatasourcePlugins();
initPlugins();
initRemotePlugins();
initNavs();

import {
  apptileNavigationRef,
  ApptileWrapper,
  ApptileAppRoot,
  useStartApptile,
} from 'apptile-core';
import {getPreviewTrackerPath} from './utils/commonUtil';
import RNFetchBlob from 'rn-fetch-blob';

declare global {
  function networkLog(logLine: string): void;
  var logger: {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };
}

const {RNApptile} = NativeModules;

const Stack = createNativeStackNavigator<ScreenParams>();

function App(): React.JSX.Element {
  const status = useStartApptile(() => {});
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  const checkIsPreviewApp = async () => {
    try {
      // read the previewTracker.json file
      const previewTrackerPath = getPreviewTrackerPath();
      const previewTracker = await RNFetchBlob.fs.exists(previewTrackerPath);

      if (!previewTracker) {
        setLoading(false);
        setPreviewMode(false);
        return;
      }

      // read the file
      const previewTrackerFile = await RNFetchBlob.fs.readFile(
        previewTrackerPath,
        'utf8',
      );
      const previewTrackerData = JSON.parse(previewTrackerFile);

      if (previewTrackerData.previewMode) {
        setLoading(false);
        setPreviewMode(true);
      } else {
        setLoading(false);
        setPreviewMode(false);
      }
    } catch (error) {
      console.error('Error reading previewTracker.json', error);
      setLoading(false);
      setPreviewMode(false);
    }
  };

  useEffect(() => {
    checkIsPreviewApp();
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
      <Stack.Navigator>
        {!previewMode ? (
          <>
            <Stack.Screen
              name="PreviewHome"
              component={HomePage}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Scanner"
              component={Scanner}
              options={{headerShown: false}}
            />
          </>
        ) : (
          <Stack.Screen
            name="NocodeRoot"
            component={ApptileAppRoot}
            options={{headerShown: false}}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );

  if (loading) {
    return (
      <View>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={{flex: 1}}>
      <ToastProvider>
        <ApptileWrapper
          onNavigationEvent={ev => {
            apptileNavigationRef.current.navigate(ev.screenName, {
              appId: status.appId,
            });
          }}
          noNavigatePaths={[]}>
          {body}
        </ApptileWrapper>
      </ToastProvider>
    </SafeAreaView>
  );
}

export default App;
