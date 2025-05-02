import React from 'react';
import {NativeModules} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import {ScreenParams} from './screenParams';
import {HomePage} from './components/HomePage';
import {Scanner} from './components/Scanner';
import Fork from './components/Fork';
import Branch from './components/Branch';
import AppDetail from './components/AppDetail';

declare global {
  function networkLog(logLine: string): void;
  var logger: {
    info: (...args: any[]) => void,
    error: (...args: any[]) => void,
    warn: (...args: any[]) => void,
  };
}

const {RNApptile} = NativeModules;

const Stack = createNativeStackNavigator<ScreenParams>();

function App(): React.JSX.Element {
  return (
    <NavigationContainer
      onReady={() => {
        RNApptile.notifyJSReady();
      }}
    >
      <Stack.Navigator>
        <Stack.Screen name="PreviewHome" component={HomePage} options={{headerShown: false}} />
        <Stack.Screen name="Scanner" component={Scanner} options={{headerShown: false}} />
        <Stack.Screen name="Fork" component={Fork} options={{headerShown: true, title: 'Forks'}} />
        <Stack.Screen name="Branch" component={Branch} options={{headerShown: true, title: 'Branches'}} />
        <Stack.Screen name="AppDetail" component={AppDetail} options={{headerShown: true, title: 'App Details'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
