/**
 * @format
 */
import 'react-native-get-random-values';
import {AppRegistry, Platform, Text, TextInput} from 'react-native';
import App from './App';
import {name as appName, pipactivityname} from './app.json';
import PIPActivity from 'PIPActivityRoot';

/* ForDynamicType (Don't remove) Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false; ForDynamicTypeEnd */

AppRegistry.registerComponent(appName, () => App);

if (Platform.OS === 'android') {
  AppRegistry.registerComponent(pipactivityname, () => PIPActivity);
}
