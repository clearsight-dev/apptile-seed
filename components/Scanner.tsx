import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  getConfigValue,
  getLocalStorageItem as getItem,
  setLocalStorageItem as setItem,
  setLocalStorageItem,
} from 'apptile-core';
import React, {useState} from 'react';
import {Dimensions, Platform, StyleSheet, Text, View} from 'react-native';
import {RNCamera} from 'react-native-camera';
import QRCodeScanner from 'react-native-qrcode-scanner';
import RNRestart from 'react-native-restart';
import {useToast} from 'react-native-toast-notifications';
import {unzip} from 'react-native-zip-archive';
import RNFetchBlob from 'rn-fetch-blob';
import {defaultBranchName} from '../constants/constant';
import {ScreenParams} from '../screenParams';
import {IAppDraftResponse, IForkWithBranches} from '../types/type';
import {fetchAppDraftApi, fetchBranchesApi, fetchForksApi} from '../utils/api';
import {
  getCustomPreviewBundlePath,
  getCustomPreviewBundleZipPath,
  getJSBundleName,
  sendToast,
  getPreviewTrackerPath,
  getAssetsDirPath,
} from '../utils/commonUtil';
import DownloadModal from './DownloadModal';

type ScreenProps = NativeStackScreenProps<ScreenParams, 'Scanner'>;

export function Scanner(props: ScreenProps) {
  const {navigation} = props;
  const toast = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');
  const [infoText, setInfoText] = useState('');
  const appIdRef = React.useRef<string | null>(null);
  const onScan = (e: {data: string}) => {
    // console.log("Camera scan result: ", e);
    // console.log(e.data.match(/appId=(.*)&appName/));
    // console.log(e.data.match(/appName=(.*)&orgName/));
    // console.log(e.data.match(/appApi=(.*)&forkId/));
    // console.log(e.data.match(/forkId=(.*)&branchName/));
    // console.log(e.data.match(/branchName=(.*)$/));
    // const appName = e.data.match(/appName=(.*)&orgName/)[1];
    const matchResult = e.data.match(/APP_ID=(.*)/);
    const appId = matchResult && matchResult[1] ? matchResult[1] : null;
    appIdRef.current = appId;

    if (!appId) {
      sendToast('No App ID found', toast);
      return;
    }
    // const forkId = parseInt(e.data.match(/forkId=(.*)&branchName/)[1]);
    // const orgName = e.data.match(/orgName=(.*)&appApi/)[1];
    setIsDownloading(true);
    console.log('Received: ', appId);
    setLocalStorageItem('appId', appId).then(() => {
      setIsDownloading(false);
      // navigation.goBack();
      fetchForks(appId);
    });
  };

  async function downloadForPreviewNonCache(
    appConfigLink: string,
    iosBundleUrl: string | null,
    androidBundleUrl: string | null,
  ) {
    setIsDownloading(true);
    setShowDownloadModal(true);

    const jsBundleDownloadPath = getCustomPreviewBundleZipPath(
      appIdRef.current!,
    );
    const jsBundleUnzipDirPath = getCustomPreviewBundlePath(appIdRef.current!);
    const jsBundlePath = `${jsBundleUnzipDirPath}/${getJSBundleName()}`;
    const appConfigDownloadPath = `${RNFetchBlob.fs.dirs.DocumentDir}/appConfig.json`;

    try {
      // Ensure the target directory for unzipping exists
      await RNFetchBlob.fs.mkdir(jsBundleUnzipDirPath).catch(err => {
        if (
          err &&
          err.message &&
          (err.message.includes('already exists') || err.code === 'EEXIST')
        ) {
          console.log(
            'Unzip directory already exists or is a file, proceeding:',
            jsBundleUnzipDirPath,
          );
        } else {
          console.error(
            'Failed to create unzip directory:',
            jsBundleUnzipDirPath,
            err,
          );
          throw err; // Re-throw if it's another error
        }
      });

      const delAppConfig = RNFetchBlob.fs
        .exists(appConfigDownloadPath)
        .then(exists => {
          if (exists) {
            return RNFetchBlob.fs.unlink(appConfigDownloadPath);
          }
        });
      const delJsBundle = RNFetchBlob.fs.exists(jsBundlePath).then(exists => {
        if (exists) {
          return RNFetchBlob.fs.unlink(jsBundlePath);
        }
      });
      const assetsFolderPath = getAssetsDirPath();
      const delAssetsFolder = RNFetchBlob.fs
        .exists(assetsFolderPath)
        .then(exists => {
          if (exists) {
            return RNFetchBlob.fs.unlink(assetsFolderPath);
          }
        });

      await Promise.all([delAppConfig, delJsBundle, delAssetsFolder]);

      setInfoText('Downloading AppConfig and JavaScript Bundle In-Progress');
      // check if appConfig.json exists in the documents dir
      const appConfigExists = await RNFetchBlob.fs.exists(
        appConfigDownloadPath,
      );
      if (appConfigExists) {
        console.log('AppConfig already exists');
        return;
      }

      const appConfigDownload = RNFetchBlob.config({
        fileCache: true,
        path: appConfigDownloadPath,
      }).fetch('GET', appConfigLink);

      let bundleUrl = null;
      if (Platform.OS === 'ios') {
        bundleUrl = iosBundleUrl;
      } else if (Platform.OS === 'android') {
        bundleUrl = androidBundleUrl;
      } else {
        console.error('[downloadForPreviewNonCache] Unsupported platform!');
      }

      let bundleDownload: any = null;
      if (bundleUrl) {
        bundleDownload = RNFetchBlob.config({
          fileCache: true,
          path: jsBundleDownloadPath,
        }).fetch('GET', bundleUrl);
      } else {
        sendToast('No Draft available', toast);
        setShowDownloadModal(false);
        setIsDownloading(false);
        navigation.navigate('PreviewHome');
      }

      console.log('going to download appConfig and bundle');
      await Promise.all([appConfigDownload, bundleDownload]);
      setInfoText('Setting up new files In-Progress');
      try {
        await unzip(jsBundleDownloadPath, jsBundleUnzipDirPath, 'UTF-8');
        console.log('Unzipped successfully');
        // --- Update previewTracker.json before restarting ---
        const bundleMainFile = getJSBundleName();

        if (!bundleMainFile) {
          console.error(
            '[downloadForPreviewNonCache] Could not determine bundle main file for platform.',
          );
          setFailureMessage('Error determining bundle file for platform.');
          setIsDownloading(false);
          setShowDownloadModal(false);
          return;
        }

        const actualPreviewBundlePath = `${jsBundleUnzipDirPath}/${bundleMainFile}`;

        const previewTrackerFileContent = JSON.stringify({
          previewMode: true,
          previewBundle: actualPreviewBundlePath,
          previewAppConfig: appConfigDownloadPath,
        });

        const previewTrackerJsonPath = getPreviewTrackerPath();
        await RNFetchBlob.fs.writeFile(
          previewTrackerJsonPath,
          previewTrackerFileContent,
          'utf8',
        );
        console.log(
          `[downloadForPreviewNonCache] Updated previewTracker.json at ${previewTrackerJsonPath} with content: ${previewTrackerFileContent}`,
        );
        // --- End previewTracker.json update logic ---

        setInfoText('Restarting App...');
        RNRestart.Restart();
      } catch (err) {
        setFailureMessage('Error in setting up new files');
        console.error(
          '[downloadForPreviewNonCache] Failed to unzip files or update tracker',
          err,
        );
      }
    } catch (err) {
      console.error(
        '[downloadForPreviewNonCache] Failed for some reason: ',
        err,
      );
      setFailureMessage('Error in downloading AppConfig and JavaScript Bundle');
    }
  }

  async function fetchForks(appId: string) {
    try {
      setShowDownloadModal(true);
      setIsDownloading(true);
      const forkData = await fetchForksApi(appId);
      if (forkData.forks.length > 1) {
        navigation.navigate('Fork', {
          appId: appId,
          forks: forkData.forks,
        });
      } else {
        const branchData: IForkWithBranches = await fetchBranchesApi(
          appId,
          forkData?.forks[0].id,
        );
        console.log('Branch data:', branchData);
        if (branchData.branches.length > 1) {
          navigation.navigate('Branch', {
            appId: appId,
            branches: branchData.branches,
            forkId: forkData?.forks[0].id,
            forkName: forkData?.forks[0].title,
            backTitle: '',
          });
        } else {
          const previewAppDraftData = await fetchAppDraftApi(
            appId,
            forkData?.forks[0].id,
            defaultBranchName,
          );
          console.log('Preview app draft data:', previewAppDraftData);
          if ((previewAppDraftData as IAppDraftResponse)?.appDraft?.commitId) {
            // const getCommitURL = await fetchCommitApi(
            //   appId,
            //   (previewAppDraftData as IAppDraftResponse).appDraft.commitId,
            // );
            // console.log('Commit URL:', getCommitURL);
            // if (getCommitURL?.url) {
            //   const manifestData = await fetchManifestApi(appId);
            //   downloadForPreviewNonCache(
            //     getCommitURL.url,
            //     manifestData.iosBundleId,
            //     manifestData.androidBundleId,
            //   );
            // } else {
            //   sendToast('No Draft available', toast);
            //   setShowDownloadModal(false);
            //   setIsDownloading(false);
            //   navigation.navigate('PreviewHome');
            // }
            const commitUrl = previewAppDraftData.appDraft.commitId;
            await downloadForPreviewNonCache(
              `https://dev-appconfigs.apptile.io/${appId}/main/main/${commitUrl}.json`,
              previewAppDraftData.appDraft.iosBundleUrl,
              previewAppDraftData.appDraft.androidBundleUrl,
            );
          } else {
            sendToast('No Draft available', toast);
            setShowDownloadModal(false);
            setIsDownloading(false);
            navigation.navigate('PreviewHome');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching forks:', error);
    }
  }

  const screenWidth = Dimensions.get('screen').width;
  const screenHeight = Dimensions.get('screen').height;
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
          setIsDownloading(false);
          setShowDownloadModal(false);
          setFailureMessage('');
          setInfoText('');
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
            {
              width: qrBoxWidth,
              height: qrBoxWidth,
              top: qrBoxTop,
              left: qrBoxLeft,
            },
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
  },
});
