import {View, Text} from 'react-native';
const buildinfo = require("../assets/buildinfo.json");

export default function BuildInfo() {
  return (
    <View>
      <Text>here we go {buildinfo}</Text>
    </View>
  );
}