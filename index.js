/**
 * @format
 */

import 'react-native-get-random-values';
import {AppRegistry, Platform} from 'react-native';
import App from './App';
import {name as appName, pipactivityname} from './app.json';
import PIPActivity from 'PIPActivityRoot';

AppRegistry.registerComponent(appName, () => App);

if (Platform.OS === 'android') {
  AppRegistry.registerComponent(pipactivityname, () => PIPActivity);
}
