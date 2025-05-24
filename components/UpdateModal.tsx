import React, {useState} from 'react';
import {
  ScrollView,
  View,
  Text,
  Button,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import RNRestart from 'react-native-restart';
import LottieView from 'lottie-react-native';
import {getAppStartAction} from 'apptile-core';
import {getJSBundleName, getLocalBundleTrackerPath} from '../utils/commonUtil';

export default function UpdateModal({route, onDismiss}) {
  const appId = route.params.appId;
  const [logText, setLogText] = useState([]);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const tempConfigPath = `${RNFetchBlob.fs.dirs.DocumentDir}/tempConfig.json`;
  const documentsAppConfigPath = `${RNFetchBlob.fs.dirs.DocumentDir}/appConfig.json`;
  const documentsBundleTrackerPath = getLocalBundleTrackerPath();
  const bundlesPath = `${RNFetchBlob.fs.dirs.DocumentDir}/bundles`;
  const readFileData = () => {
    setLogText(logText =>
      logText.concat(`reading: ${documentsBundleTrackerPath}`),
    );
    RNFetchBlob.fs
      .readFile(documentsBundleTrackerPath, 'utf8')
      .then(res => {
        setLogText(logText => logText.concat(res));
      })
      .catch(err => {
        setLogText(logText => logText.concat(err.message));
      });
  };

  const deleteCodePushedBundle = () => {
    return RNFetchBlob.fs
      .exists(RNFetchBlob.fs.dirs.DocumentDir + '/bundles/' + getJSBundleName())
      .then(exists => {
        if (exists) {
          return RNFetchBlob.fs.unlink(
            RNFetchBlob.fs.dirs.DocumentDir + '/bundles/' + getJSBundleName(),
          );
        }
      })
      .catch(err => {
        console.error('Failed to delete existing active bundle', err);
      });
  };

  const updatePreviewApp = () => {
    if (!isDownloadingUpdate) {
      setIsDownloadingUpdate(true);
      getAppStartAction(appId)
        .then(res => {
          if (res.hasError) {
            console.error('Error has occurred trying to get config: ', res);
            return {err: 'error when getting ota check'};
          } else if (res.updateCheckResult) {
            return res.updateCheckResult;
          }
        })
        .then(updateCheckResult => {
          setIsDownloadingUpdate(false);
          setLogText(logText =>
            logText.concat(
              'check result: ' + JSON.stringify(updateCheckResult),
            ),
          );
        })
        .catch(err => {
          setIsDownloadingUpdate(false);
          setLogText(logText =>
            logText.concat('Failed to check: ' + err.message),
          );
        });
    }
  };

  const restartApp = () => {
    RNRestart.Restart();
  };

  const revertCodePush = () => {
    deleteCodePushedBundle().then(() => {
      RNRestart.Restart();
    });
  };

  let loadingAnimation = (
    <View
      style={{
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Image
        style={{
          height: 50,
          width: 50,
          marginBottom: 20,
          borderRadius: 8,
        }}
        source={require('../assets/logo.png')}
        resizeMode="contain"
      />
      <Text
        style={{
          fontWeight: '100',
        }}>
        Click update to pull latest code and restart
      </Text>
      <Text
        style={{
          fontWeight: '100',
        }}>
        Or open this screen anytime from the sidemenu.
      </Text>
    </View>
  );
  if (isDownloadingUpdate) {
    loadingAnimation = (
      <LottieView
        style={{
          width: '100%',
          height: 200,
        }}
        source={require('../assets/loadingplane.json')}
        autoPlay
        loop
      />
    );
  }

  let doneButton = null;
  if (onDismiss) {
    doneButton = (
      <View
        style={{
          width: '100%',
          justifyContent: 'flex-end',
          flexDirection: 'row',
        }}>
        <Button title="cancel" onPress={onDismiss}></Button>
      </View>
    );
  }

  return (
    <View>
      {doneButton}
      <ScrollView>
        {loadingAnimation}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            paddingLeft: 20,
            paddingRight: 20,
          }}>
          <Button
            disabled={isDownloadingUpdate}
            title="Factory settings"
            onPress={revertCodePush}></Button>
          <Button title="ReadFileData" onPress={readFileData}></Button>
          <Button title="Restart" onPress={restartApp}></Button>
          {/*<View
            style={{
              borderWidth: 1,
              borderColor: 'blue',
              borderRadius: 18 
            }}
          >
            <Button
              disabled={isDownloadingUpdate}
              title="Update"
              onPress={updatePreviewApp}>
            </Button>
          </View>*/}
        </View>
        <Text>{logText.join('\n')}</Text>
      </ScrollView>
    </View>
  );
}
