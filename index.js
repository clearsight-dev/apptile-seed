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
import {name as appName, pipactivityname, videopipactivityname} from './app.json';
import PIPActivity from 'PIPActivityRoot';
import VideoPIPActivity from './VideoPIPActivityRoot';

// Disable dynamic type / font scaling if flag is set
const {RNGetValues} = NativeModules;
if (RNGetValues) {
  const onSuccess = value => {
    if (value === 'true') {
      Text.defaultProps = Text.defaultProps || {};
      Text.defaultProps.allowFontScaling = false;
      TextInput.defaultProps = TextInput.defaultProps || {};
      TextInput.defaultProps.allowFontScaling = false;
    }
  };
  if (Platform.OS === 'ios') {
    RNGetValues.getKey('DISABLE_DYNAMIC_TYPE', (error, value) => {
      if (!error) {
        onSuccess(value);
      }
    });
  } else {
    RNGetValues.getKey(
      'DISABLE_DYNAMIC_TYPE',
      () => {
        // Error callback - flag not found, do nothing
      },
      onSuccess,
    );
  }
}

AppRegistry.registerComponent(appName, () => App);

if (Platform.OS === 'android') {
  AppRegistry.registerComponent(pipactivityname, () => PIPActivity);
  AppRegistry.registerComponent(videopipactivityname, () => VideoPIPActivity);
}
