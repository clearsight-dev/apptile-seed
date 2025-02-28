import React, {useState} from 'react';
import {Dimensions, View, Alert, ActivityIndicator, Text} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import QRCodeScanner from 'react-native-qrcode-scanner';
import {RNCamera} from 'react-native-camera';
// import AsyncStorage from '../utils/MetaData';
import RNFetchBlob from 'rn-fetch-blob';
import axios from 'axios';

import {ScreenParams} from '../App';
import {download, downloadTransient} from '../utils/download';
import {setLocalStorageItem} from '../../../apptile-cli-home/ReactNativeTSProjeect/packages/apptile-core/sdkComponents';
type ScreenProps = NativeStackScreenProps<ScreenParams, 'PreviewScanner'>;

export function Scanner(props: ScreenProps) {
  const {navigation} = props;
  const [isDownloading, setIsDownloading] = useState(false);
  const useTransientStorage = props.route.params?.useTransientStorage || null;
  const onScan = (e: {data: string}) => {
    // console.log("Camera scan result: ", e);
    // console.log(e.data.match(/appId=(.*)&appName/));
    // console.log(e.data.match(/appName=(.*)&orgName/));
    // console.log(e.data.match(/appApi=(.*)&forkId/));
    // console.log(e.data.match(/forkId=(.*)&branchName/));
    // console.log(e.data.match(/branchName=(.*)$/));
    // const appName = e.data.match(/appName=(.*)&orgName/)[1];
    const appId = e.data.match(/APP_ID=(.*)&appName/)[1];
    // const forkId = parseInt(e.data.match(/forkId=(.*)&branchName/)[1]);
    // const orgName = e.data.match(/orgName=(.*)&appApi/)[1];
    setIsDownloading(true);
    console.log('Received: ', appId);
    console.log('setting local storage item');
    setLocalStorageItem('appId', appId).then(() => {
      navigation.goBack();
      console.log('going back');
    });
  };

  const screenWidth = Dimensions.get('screen').width;
  const screenHeight = Dimensions.get('screen').height;
  const qrBoxWidth = Math.min(screenWidth * 0.8, 400);

  const qrBoxTop = (screenHeight - qrBoxWidth) * 0.5;
  const qrBoxLeft = (screenWidth - qrBoxWidth) * 0.5;

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        ...(isDownloading
          ? {
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              backgroundColor: 'white',
            }
          : {}),
      }}>
      {isDownloading && (
        <>
          <ActivityIndicator size="large" />
          <Text style={{color: 'black'}}>Downloading latest appsave...</Text>
        </>
      )}
      {!isDownloading && (
        <>
          <QRCodeScanner
            containerStyle={{
              backgroundColor: 'black',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            cameraContainerStyle={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
            cameraStyle={{
              width: '100%',
              height: '100%',
            }}
            topViewStyle={{height: 0}}
            bottomViewStyle={{height: 0}}
            onRead={onScan}
            flashMode={RNCamera.Constants.FlashMode.off}
            reactivate={true}
            reactivateTimeout={1000}
          />
          <View
            style={{
              // borderWidth: 3,
              // borderColor: '#1060E0',
              width: qrBoxWidth,
              height: qrBoxWidth,
              position: 'absolute',
              top: qrBoxTop,
              left: qrBoxLeft,
            }}>
            <View
              style={{
                borderWidth: 3,
                width: 100,
                height: 100,
                position: 'absolute',
                left: 0,
                top: 0,
                borderTopLeftRadius: 20,
                borderTopColor: '#1060e0',
                borderLeftColor: '#1060e0',
                borderBottomColor: '#ff000001',
                borderRightColor: '#ff000001',
              }}></View>

            <View
              style={{
                borderWidth: 3,
                width: 100,
                height: 100,
                position: 'absolute',
                right: 0,
                top: 0,
                borderTopRightRadius: 20,
                borderTopColor: '#1060e0',
                borderRightColor: '#1060e0',
                borderBottomColor: '#ff000001',
                borderLeftColor: '#ff000001',
              }}></View>

            <View
              style={{
                borderWidth: 3,
                width: 100,
                height: 100,
                position: 'absolute',
                left: 0,
                bottom: 0,
                borderBottomLeftRadius: 20,
                borderBottomColor: '#1060e0',
                borderLeftColor: '#1060e0',
                borderTopColor: '#ff000001',
                borderRightColor: '#ff000001',
              }}></View>

            <View
              style={{
                borderWidth: 3,
                width: 100,
                height: 100,
                position: 'absolute',
                right: 0,
                bottom: 0,
                borderBottomRightRadius: 20,
                borderBottomColor: '#1060e0',
                borderRightColor: '#1060e0',
                borderLeftColor: '#ff000001',
                borderTopColor: '#ff000001',
              }}></View>
          </View>
        </>
      )}
    </View>
  );
}
