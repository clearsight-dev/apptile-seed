import React, {useState} from 'react';
import {Dimensions, View, Alert, ActivityIndicator, Text} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import QRCodeScanner from 'react-native-qrcode-scanner';
import {RNCamera} from 'react-native-camera';
// import AsyncStorage from '../utils/MetaData';
import RNFetchBlob from 'rn-fetch-blob';
import axios from 'axios';

import { ScreenParams } from '../screenParams';
import { download, downloadTransient } from '../utils/download';
import { IAppForksResponse, IForkWithBranches, NavigationProp } from '../types/type';
import { defaultBranchName } from '../constants/constant';
import { fetchBranchesApi } from '../utils/api';
type ScreenProps = NativeStackScreenProps<ScreenParams, 'Scanner'>;

export function Scanner(props: ScreenProps) {
  const {navigation} = props;
  const [isDownloading, setIsDownloading] = useState(false);
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
    setIsDownloading(true)
    console.log("Received: ", appId);
    setLocalStorageItem("appId", appId).then(() => {
      setIsDownloading(false)
      // navigation.goBack();
      fetchForks(appId);
    });
  };

    // setApps(apps => {
    //   console.log("Setting apps");
    //   if (!apps.find(entry => entry.id == appId)) {
    //     const newEntry = {name: appName, id: appId, fork: forkId};
    //     apps = apps.concat(newEntry);
    //   }
    //   console.log("pushing apps: ", apps);
    //   return apps;
    // });
  }

  async function fetchForks(appId: string) {
    try {
      // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const APPTILE_API_ENDPOINT = 'http://localhost:3000';
      console.log('Fetching forks for appId:', appId,`${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/forks`);
      const response = await fetch(`${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/forks`);
      console.log('Response:', response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const forkData: IAppForksResponse = await response.json();
      
      if (forkData.forks.length > 1) {
        navigation.navigate('Fork', {
          appId: appId,
          forks: forkData.forks
        });
      } else {
        // when the fork is only one, then we can directly go to the App Detail Page.
        // but need to check If there are any versions created for that fork
        const branchData: IForkWithBranches = await fetchBranchesApi(appId, forkData?.forks[0].id);
        if (branchData.branches.length > 1) {
          // Navigate to Branch screen if there are multiple branches
          navigation.navigate('Branch', {
            appId: appId,
            branches: branchData.branches,
            forkId: forkData?.forks[0].id,
            forkName: forkData?.forks[0].title,
            backTitle: ''
          });
        } else {
          // Navigate to AppDetail screen if there's only one branch
          navigation.navigate('AppDetail', {
            appId: appId,
            forkId: forkData.forks[0].id,
            branchName:defaultBranchName,
            forkName: forkData?.forks[0].title,
            backTitle: '',
            branchTitle: branchData?.branches?.[0]?.title || defaultBranchName,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching forks:', error);
    }
  }

  const screenWidth = Dimensions.get("screen").width;
  const screenHeight = Dimensions.get("screen").height;
  const qrBoxWidth = Math.min(screenWidth * 0.8, 400);

  const qrBoxTop = (screenHeight - qrBoxWidth) * 0.5;
  const qrBoxLeft = (screenWidth - qrBoxWidth) * 0.5;

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        ...(isDownloading ? {
          justifyContent: 'center', 
          alignItems: 'center', 
          flexDirection: 'column',
          backgroundColor: 'white'
          } : {})
      }}
    >
      <Text style={{color: 'black', marginTop: 100}} onPress={() => fetchForks('b834d097-ea9b-4026-bc0a-fc873be78bb8')}>Scan QR Code</Text>
      {isDownloading && 
        <>
          <ActivityIndicator size="large" />
          <Text style={{color: 'black'}}>Downloading latest appsave...</Text>
        </>
      }
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
