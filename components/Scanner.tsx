import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getConfigValue, getLocalStorageItem as getItem, setLocalStorageItem as setItem, setLocalStorageItem } from 'apptile-core';
import React, { useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { RNCamera } from "react-native-camera";
import QRCodeScanner from "react-native-qrcode-scanner";
import RNRestart from 'react-native-restart';
import { useToast } from "react-native-toast-notifications";
import { unzip } from 'react-native-zip-archive';
import RNFetchBlob from 'rn-fetch-blob';
import { defaultBranchName } from '../constants/constant';
import { ScreenParams } from '../screenParams';
import { IAppDraftResponse, IAppForksResponse, IArtefact, IForkWithBranches } from '../types/type';
import { fetchAppDraftApi, fetchBranchesApi, fetchCommitApi, fetchManifestApi, fetchPushLogsApi } from '../utils/api';
import { sendToast } from '../utils/commonUtil';
import DownloadModal from './DownloadModal';

type ScreenProps = NativeStackScreenProps<ScreenParams, 'Scanner'>;

export function Scanner(props: ScreenProps) {
  const { navigation } = props;
  const toast = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');
  const [infoText, setInfoText] = useState('');
  const onScan = (e: { data: string }) => {
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

  async function downloadForPreviewNonCache(
    cdnlink: string,
    iosBundleId: number | null,
    androidBundleId: number | null
  ) {
    setIsDownloading(true);
    setShowDownloadModal(true);
    const appConfigPath = RNFetchBlob.fs.dirs.DocumentDir + '/appConfig.json';
    const delAppConfig = RNFetchBlob.fs.exists(appConfigPath).then(exists => {
      if (exists) {
        return RNFetchBlob.fs.unlink(appConfigPath);
      }
    });
    const jsBundlePath = RNFetchBlob.fs.dirs.DocumentDir + '/bundles/main.jsbundle';
    const delJsBundle = RNFetchBlob.fs.exists(jsBundlePath).then(exists => {
      if (exists) {
        return RNFetchBlob.fs.unlink(jsBundlePath);
      }
    });
    const assetsFolderPath = RNFetchBlob.fs.dirs.DocumentDir + '/bundles/assets';
    const delAssetsFolder = RNFetchBlob.fs.exists(assetsFolderPath).then(exists => {
      if (exists) {
        return RNFetchBlob.fs.unlink(assetsFolderPath);
      }
    });
    await setItem('generateCache', 'YES');
    try {
      await Promise.all([delAppConfig, delJsBundle, delAssetsFolder]);
      setInfoText('Downloading AppConfig and JavaScript Bundle In-Progress')
      const appconfigUrl = cdnlink;
      const appConfigDownload = RNFetchBlob.config({
        fileCache: true,
        path: RNFetchBlob.fs.dirs.DocumentDir + '/appConfig.json'
      })
        .fetch('GET', appconfigUrl);

      // Fetch push logs from API
      let artefacts: IArtefact[] = [];
      try {
        const appId = await getItem('appId');
        if (appId) {
          const pushLogs = await fetchPushLogsApi(appId);
          artefacts = pushLogs.artefacts;
        }
      } catch (err) {
        console.error('[downloadForPreviewNonCache] Failed to fetch push logs', err);
      }

      let bundleUrl = null;
      if (Platform.OS === 'ios') {
        const artefact = artefacts.find(asset => {
          return (asset.type === 'ios-jsbundle') && (asset.id === iosBundleId);
        });
        if (artefact) {
          bundleUrl = artefact.cdnlink;
        }
      } else if (Platform.OS === 'android') {
        const artefact = artefacts.find(asset => {
          return (asset.type === 'android-jsbundle') && (asset.id === androidBundleId)
        });
        if (artefact) {
          bundleUrl = artefact.cdnlink;
        }
      } else {
        console.error('[downloadForPreviewNonCache] Unsupported platform!');
      }

      let bundleDownload: any = null;
      if (bundleUrl) {
        bundleDownload = RNFetchBlob.config({
          fileCache: true,
          path: RNFetchBlob.fs.dirs.DocumentDir + '/bundles/bundle.zip'
        })
          .fetch('GET', bundleUrl);
      }

      await Promise.all([appConfigDownload, bundleDownload]);
      setInfoText('Setting up new files In-Progress')
      try {
        const bundlesPath = `${RNFetchBlob.fs.dirs.DocumentDir}/bundles`;
        await unzip(`${bundlesPath}/bundle.zip`, `${bundlesPath}`, 'UTF-8');
        setInfoText('Restarting App...')
        RNRestart.Restart()
      } catch (err) {
        setFailureMessage('Error in setting up new files')
        console.error('[downloadForPreviewNonCache] Failed to unzip files', err)
      }
    } catch (err) {
      console.error('[downloadForPreviewNonCache] Failed for some reason: ', err);
      setFailureMessage('Error in downloading AppConfig and JavaScript Bundle')
    }
  }

  async function fetchForks(appId: string) {
    try {
      setShowDownloadModal(true)
      setIsDownloading(true)
      const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const response = await fetch(`${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/forks`);
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
        const branchData: IForkWithBranches = await fetchBranchesApi(appId, forkData?.forks[0].id);
        if (branchData.branches.length > 1) {
          navigation.navigate('Branch', {
            appId: appId,
            branches: branchData.branches,
            forkId: forkData?.forks[0].id,
            forkName: forkData?.forks[0].title,
            backTitle: ''
          });
        } else {
          const previewAppDraftData = await fetchAppDraftApi(appId, forkData?.forks[0].id, defaultBranchName);
          if ((previewAppDraftData as IAppDraftResponse)?.appDraft?.commitId) {
            const getCommitURL = await fetchCommitApi((previewAppDraftData as IAppDraftResponse).appDraft.commitId);
            if (getCommitURL.url) {
              const manifestData = await fetchManifestApi(appId);
              downloadForPreviewNonCache(
                getCommitURL.url,
                manifestData.iosBundleId,
                manifestData.androidBundleId
              )
            } else {
              sendToast('No Draft available', toast);
            }
          } else {
            sendToast('No Draft available', toast);
          }
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
      style={[styles.container, isDownloading && styles.downloadingContainer]}>
      <DownloadModal
        visible={showDownloadModal}
        isDownloading={isDownloading}
        failureMessage={failureMessage}
        infoText={infoText}
        onClose={() => {
          setIsDownloading(false)
          setShowDownloadModal(false)
          setFailureMessage('')
          setInfoText('')
        }}
      />
      <>
        <QRCodeScanner
          containerStyle={styles.qrScannerContainer}
          cameraContainerStyle={styles.qrCameraContainer}
          cameraStyle={styles.qrCamera}
          topViewStyle={styles.qrTopView}
          bottomViewStyle={styles.qrBottomView}
          onRead={onScan}
          flashMode={RNCamera.Constants.FlashMode.off}
          reactivate={true}
          reactivateTimeout={1000}
        />
        <View
          style={[
            styles.qrBox,
            { width: qrBoxWidth, height: qrBoxWidth, top: qrBoxTop, left: qrBoxLeft }
          ]}>
          <View style={styles.qrCornerTopLeft} />
          <View style={styles.qrCornerTopRight} />
          <View style={styles.qrCornerBottomLeft} />
          <View style={styles.qrCornerBottomRight} />
        </View>
      </>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  downloadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    backgroundColor: 'white',
  },
  scanText: {
    color: 'black',
    marginTop: 100,
  },
  downloadingText: {
    color: 'black',
  },
  qrScannerContainer: {
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCameraContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  qrCamera: {
    width: '100%',
    height: '100%',
  },
  qrTopView: {
    height: 0,
  },
  qrBottomView: {
    height: 0,
  },
  qrBox: {
    position: 'absolute',
  },
  qrCornerTopLeft: {
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
  },
  qrCornerTopRight: {
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
  },
  qrCornerBottomLeft: {
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
  },
  qrCornerBottomRight: {
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
  }
});