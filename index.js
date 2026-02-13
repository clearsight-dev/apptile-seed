/**
 * @format
 */
import 'react-native-get-random-values';
import {
  AppRegistry,
  Platform,
  Text,
  TextInput,
  NativeModules,
} from 'react-native';
import App from './App';
import {name as appName, pipactivityname} from './app.json';
import PIPActivity from 'PIPActivityRoot';

// Disable dynamic type / font scaling if flag is set
const {RNGetValues} = NativeModules;
if (RNGetValues) {
  RNGetValues.getKey(
    'DISABLE_DYNAMIC_TYPE',
    () => {
      // Error callback - flag not found, do nothing
    },
    value => {
      if (value === 'true') {
        Text.defaultProps = Text.defaultProps || {};
        Text.defaultProps.allowFontScaling = false;
        TextInput.defaultProps = TextInput.defaultProps || {};
        TextInput.defaultProps.allowFontScaling = false;
      }
    },
  );
}

AppRegistry.registerComponent(appName, () => App);

if (Platform.OS === 'android') {
  AppRegistry.registerComponent(pipactivityname, () => PIPActivity);
}
