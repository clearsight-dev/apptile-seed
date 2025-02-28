import React, { useEffect, useReducer } from 'react';
import { View, Text, Linking, Button, Pressable, ScrollView, Platform, Modal, ActivityIndicator, Image, SafeAreaView } from 'react-native';
import { 
  getConfigValue,
  getLocalStorageItem as getItem,
  setLocalStorageItem as setItem
} from 'apptile-core';
import RNFetchBlob from 'rn-fetch-blob';
import { unzip } from 'react-native-zip-archive';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import RNRestart from 'react-native-restart';
import { ScreenParams } from '../screenParams';
// import { getItem, setItem } from '../utils/AsyncStorage';
import { layout, text, bgColor, border, buttons } from '../styles';

// TODO(gaurav) when artefactId is -1 set it back to null after api call
type HomeState = {
  appId: null | string;
  hasError: boolean;
  errorMessage: string;
  pushLogs: {
    logs: Array<{
      androidBundleId: null | number;
      appId: string;
      comment: string;
      createdAt: string;
      id: number;
      iosBundleId: null | number;
      navigatorsBundleId: null | number;
      pluginsBundleId: null | number;
      publishedCommitId: null | number;
      updatedAt: string;
    }>;
    artefacts: Array<{
      id: number;
      type: "ios-jsbundle" | "android-jsbundle" | "navigator-bundle" | "plugin-bundle";
      cdnlink: string;
    }>;
  };
  manifest: {
    name: string;
    published: boolean;
    androidBundleId: null | number;
    iosBundleId: null | number;
    forks: Array<{
      id: string|number;
      title: string;
      publishedCommitId: number | null;
      mainBranchLatestSave: {
        commitId: number;
        cdnlink: string;
      };
    }>;
  };
  launchSequence: Array<{ label: string; status: "notstarted" | "inprogress" | "error" | "success" }>;
  showLaunchSequence: boolean;
};
type ScreenProps = NativeStackScreenProps<ScreenParams, 'PreviewHome'>;
type HomeAction = { type: 'SET_APP_ID'; payload: string | null; } |
{ type: 'SET_ERROR'; payload: string; } |
{ type: 'SET_PUSHLOGS'; payload: HomeState['pushLogs']; } |
{ type: 'SET_MANIFEST'; payload: HomeState['manifest']; } |
{ type: 'SET_LAUNCH_SEQUENCE'; payload: HomeState['launchSequence']; } |
{ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY'; payload: HomeState['showLaunchSequence'];} |
{ 
  type: 'UPDATE_FORK_IN_MANIFEST'; 
  payload: { 
    forkId: number|string; 
    mainBranchLatestSave: {
      commitId: number; 
      cdnlink: string;
    } 
  }
}
;
type DispatchFcn = (action: HomeAction) => void;
type DownloadCodepushCb = (publishedCommitId: number | null, iosBundleId: number | null, androidBundleId: number | null) => Promise<void>;
type DownloadNonCacheCodepushCb = (cdnlink: string, iosBundleId: number | null, androidBundleId: number | null) => Promise<void>;


async function fetchAppId(dispatch: DispatchFcn, url?: string): Promise<null | string> {
  let appId: string | null = null;
  try {
    appId = await getItem('appId');
    let initialUrl = url || null;
    if (!initialUrl) {
      initialUrl = await Linking.getInitialURL();
    }

    if (!appId) {
      if (initialUrl && initialUrl.startsWith('apptilepreview://locktoapp/')) {
        appId = initialUrl.slice('apptilepreview://locktoapp/'.length);
        try {
          await setItem("appId", appId);
        } catch (err) {
          dispatch({
            type: 'SET_ERROR',
            payload: err?.toString() || "noerror"
          });
        }
      }
    } else {
      if (initialUrl && initialUrl.startsWith('apptilepreview://unlock')) {
        appId = null;
        await setItem('appId', null);
      }
    }
  } catch (err) {
    dispatch({
      type: 'SET_ERROR',
      payload: err?.toString() || "noerror"
    });
  }

  console.log('setting appId to: ', appId);
  dispatch({
    type: 'SET_APP_ID',
    payload: appId
  });
  return appId;
}

async function fetchPushLogs(appId: string, dispatch: DispatchFcn) {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/pushLogs`;
    let pushLogs = await fetch(url).then(res => res.json())
    dispatch({
      type: 'SET_PUSHLOGS',
      payload: pushLogs
    });
  } catch (err) {
    console.error("Failed to fetch pushLogs: " + (err || "noerror").toString());
    dispatch({
      type: 'SET_ERROR',
      payload: "failed to fetch pushLogs: " + (err || "noerror").toString()
    });
  }
}

async function fetchManifest(appId: string, dispatch: DispatchFcn) {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/manifest`;
    const manifestData: any = await fetch(url).then(res => res.json());

    let manifest: HomeState['manifest'] = {
      name: manifestData.name,
      published: manifestData.published,
      androidBundleId: manifestData.androidBundleId,
      iosBundleId: manifestData.iosBundleId,
      forks: manifestData.forks.map((f: any) => {
        return {
          id: f.id,
          title: f.title,
          publishedCommitId: f.publishedCommitId,
          mainBranchLatestSave: {
            commitId: -1,
            cdnlink: ''
          }
        };
      })
    };

    dispatch({
      type: 'SET_MANIFEST',
      payload: manifest
    });

    for (let i = 0; i < manifest.forks.length; ++i) {
      const fork = manifest.forks[i];
      const mainBranchLatestSave = await fetchLastSavedConfig(appId, fork.id);
      dispatch({
        type: 'UPDATE_FORK_IN_MANIFEST',
        payload: {
          forkId: fork.id,
          mainBranchLatestSave
        }
      });
    }
  } catch (err) {
    dispatch({
      type: 'SET_ERROR',
      payload: "failed to fetch manifest: " + (err || "noerror").toString()
    });
  }
}

async function fetchLastSavedConfig(appId: string, forkId: number|string) {
  const result = {
    commitId: -1,
    cdnlink: ''
  };

  try {
    const apiEndpoint = await getConfigValue('APPTILE_API_ENDPOINT');
    const {url} = await fetch(`${apiEndpoint}/api/v2/app/${appId}/${forkId}/main/noRedirect`).then(res => res.json())
    const commitId = url.match(/\/([0-9]+)\.json$/);
    if (commitId && commitId[1]) {
      result.cdnlink = url;
      result.commitId = parseInt(commitId[1]);
    }
  } catch(err) {
    console.error("Failed to get the lastest save");
  }
  return result;
}

async function initialize(dispatch: DispatchFcn) {
  const appId = await fetchAppId(dispatch);
  if (appId) {
    await Promise.all([
      fetchPushLogs(appId, dispatch),
      fetchManifest(appId, dispatch)
    ]);
  }
}

function reducer(state: HomeState, action: HomeAction): HomeState {
  let result: HomeState;
  switch (action.type) {
    case 'SET_APP_ID':
      result = { ...state, appId: action.payload };
      break;
    case 'SET_ERROR':
      result = { ...state, hasError: true, errorMessage: action.payload };
      break;
    case 'SET_PUSHLOGS':
      result = { ...state, pushLogs: action.payload };
      break;
    case 'SET_MANIFEST':
      result = { ...state, manifest: action.payload };
      break;
    case 'SET_LAUNCH_SEQUENCE':
      result = {...state, launchSequence: action.payload};
      break;
    case 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY':
      result = {...state, showLaunchSequence: action.payload};
      break;
    case 'UPDATE_FORK_IN_MANIFEST':
    {
      // TODO(gaurav): add immer
      const existingForkIndex = state.manifest.forks.findIndex(fork => fork.id === action.payload.forkId);
      if (existingForkIndex >= 0) {
        let forks = state.manifest.forks;
        forks[existingForkIndex] = {
          ...forks[existingForkIndex],
          mainBranchLatestSave: action.payload.mainBranchLatestSave
        }
        result = {
          ...state,
          manifest: {
            ...state.manifest,
            forks 
          }
        };
      } else {
        result = state;
      }
      break;
    }
    default:
      result = state;
  }
  return result;
}

async function downloadForPreviewNonCache(
  store: HomeState, 
  dispatch: DispatchFcn, 
  cdnlink: string,
  iosBundleId: number | null, 
  androidBundleId: number | null) {
  // check for existing bundle and config and delete them
  dispatch({type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true});
  const appConfigPath = RNFetchBlob.fs.dirs.DocumentDir + '/appConfig.json';
  const delAppConfig = RNFetchBlob.fs.exists(appConfigPath).then(exists => {
    if (exists) {
      return RNFetchBlob.fs.unlink(appConfigPath);
    }
  });

  let jsBundlePath;
  if (Platform.OS === 'ios') {
    jsBundlePath = RNFetchBlob.fs.dirs.DocumentDir + '/bundles/main.jsbundle';
  } else {
    jsBundlePath =
      RNFetchBlob.fs.dirs.DocumentDir + '/bundles/index.android.bundle';
  }

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
    dispatch({
      type: 'SET_LAUNCH_SEQUENCE',
      payload: [
        {
          label: 'Clear old files',
          status: 'success'
        },
        {
          label: 'Download appconfig',
          status: 'inprogress'
        },
        {
          label: 'Download javascript bundle',
          status: 'inprogress'
        },
        {
          label: 'Setup new files',
          status: 'notstarted'
        }
      ]
    });

    const appconfigUrl = cdnlink;
    console.log("Appconfig url: " + appconfigUrl);

    const appConfigDownload = RNFetchBlob.config({
      fileCache: true,
      path: RNFetchBlob.fs.dirs.DocumentDir + '/appConfig.json'
    })
      .fetch('GET', appconfigUrl);

    let bundleUrl = null;
    if (Platform.OS === 'ios') {
      const artefact = store.pushLogs.artefacts.find(asset => {
        return (asset.type === 'ios-jsbundle') && (asset.id === iosBundleId);
      });

      if (artefact) {
        bundleUrl = artefact.cdnlink;
      }

    } else if (Platform.OS === 'android') {
      const artefact = store.pushLogs.artefacts.find(asset => {
        return (asset.type === 'android-jsbundle') && (asset.id === androidBundleId)
      });

      if (artefact) {
        bundleUrl = artefact.cdnlink;
      }
    } else {
      logger.error("Unspported platform!");
    }

    let bundleDownload: any = null;
    if (bundleUrl) {
      logger.info("Downloading bundle from: ", bundleUrl);
      bundleDownload = RNFetchBlob.config({
        fileCache: true,
        path: RNFetchBlob.fs.dirs.DocumentDir + '/bundles/bundle.zip'
      })
        .fetch('GET', bundleUrl);
    }

    await Promise.all([appConfigDownload, bundleDownload]);
    dispatch({
      type: 'SET_LAUNCH_SEQUENCE',
      payload: [
        {
          label: 'Clear old files',
          status: 'success'
        },
        {
          label: 'Download appconfig',
          status: 'success'
        },
        {
          label: 'Download javascript bundle',
          status: 'success'
        },
        {
          label: 'Setup new files',
          status: 'inprogress'
        }
      ]
    });

    try {
      const bundlesPath = `${RNFetchBlob.fs.dirs.DocumentDir}/bundles`;
      logger.info("bundlesPath: ", bundlesPath);
      await unzip(`${bundlesPath}/bundle.zip`, `${bundlesPath}`, 'UTF-8');
      dispatch({
        type: 'SET_LAUNCH_SEQUENCE',
        payload: [
          {
            label: 'Clear old files',
            status: 'success'
          },
          {
            label: 'Download appconfig',
            status: 'success'
          },
          {
            label: 'Download javascript bundle',
            status: 'success'
          },
          {
            label: 'Setup new files',
            status: 'success'
          }
        ]
      });
    } catch (err) {
      logger.error("Failed to unzip files", err)
      dispatch({
        type: 'SET_LAUNCH_SEQUENCE',
        payload: [
          {
            label: 'Clear old files',
            status: 'success'
          },
          {
            label: 'Download appconfig',
            status: 'success'
          },
          {
            label: 'Download javascript bundle',
            status: 'success'
          },
          {
            label: 'Setup new files',
            status: 'error'
          }
        ]
      });
    }
    
  } catch (err) {
    logger.error("Failed for some reason: ", err);
    dispatch({
      type: 'SET_LAUNCH_SEQUENCE',
      payload: [
        {
          label: 'Clear old files',
          status: 'error'
        },
        {
          label: 'Download appconfig',
          status: 'error'
        },
        {
          label: 'Download javascript bundle',
          status: 'error'
        },
        {
          label: 'Setup new files',
          status: 'error'
        }
      ]
    });
  }
}

async function downloadForPreview(
  store: HomeState,
  dispatch: DispatchFcn,
  publishedCommitId: number|null,
  iosBundleId: number | null,
  androidBundleId: number | null) {
  // check for existing bundle and config and delete them
  dispatch({type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true});
  const appConfigPath = RNFetchBlob.fs.dirs.DocumentDir + '/appConfig.json';
  const delAppConfig = RNFetchBlob.fs.exists(appConfigPath).then(exists => {
    if (exists) {
      return RNFetchBlob.fs.unlink(appConfigPath);
    }
  });

  let jsBundlePath;
  if (Platform.OS === 'ios') {
    jsBundlePath = RNFetchBlob.fs.dirs.DocumentDir + '/bundles/main.jsbundle';
  } else {
    jsBundlePath =
      RNFetchBlob.fs.dirs.DocumentDir + '/bundles/index.android.bundle';
  }

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

  await setItem('generateCache', 'NO');

  try {
    await Promise.all([delAppConfig, delJsBundle, delAssetsFolder]);
    dispatch({
      type: 'SET_LAUNCH_SEQUENCE',
      payload: [
        {
          label: 'Clear old files',
          status: 'success'
        },
        {
          label: 'Download appconfig',
          status: 'inprogress'
        },
        {
          label: 'Download javascript bundle',
          status: 'inprogress'
        },
        {
          label: 'Setup new files',
          status: 'notstarted'
        }
      ]
    });
    const apptileBackendUrl = await getConfigValue('APPTILE_UPDATE_ENDPOINT');
    if (store.appId && publishedCommitId) {
      const appconfigUrl = `${apptileBackendUrl}/${store.appId}/main/main/${publishedCommitId}.json`;
      console.log("Appconfig url: " + appconfigUrl);

      const appConfigDownload = RNFetchBlob.config({
        fileCache: true,
        path: RNFetchBlob.fs.dirs.DocumentDir + '/appConfig.json'
      })
        .fetch('GET', appconfigUrl);

      let bundleUrl = null;
      if (Platform.OS === 'ios') {
        const artefact = store.pushLogs.artefacts.find(asset => {
          return (asset.type === 'ios-jsbundle') && (asset.id === iosBundleId);
        });

        if (artefact) {
          bundleUrl = artefact.cdnlink;
        }

      } else if (Platform.OS === 'android') {
        const artefact = store.pushLogs.artefacts.find(asset => {
          return (asset.type === 'android-jsbundle') && (asset.id === androidBundleId)
        });

        if (artefact) {
          bundleUrl = artefact.cdnlink;
        }
      } else {
        logger.error("Unspported platform!");
      }

      let bundleDownload: any = null;
      if (bundleUrl) {
        logger.info("Downloading bundle from: ", bundleUrl);
        bundleDownload = RNFetchBlob.config({
          fileCache: true,
          path: RNFetchBlob.fs.dirs.DocumentDir + '/bundles/bundle.zip'
        })
          .fetch('GET', bundleUrl);
      }

      await Promise.all([appConfigDownload, bundleDownload]);
      dispatch({
        type: 'SET_LAUNCH_SEQUENCE',
        payload: [
          {
            label: 'Clear old files',
            status: 'success'
          },
          {
            label: 'Download appconfig',
            status: 'success'
          },
          {
            label: 'Download javascript bundle',
            status: 'success'
          },
          {
            label: 'Setup new files',
            status: 'inprogress'
          }
        ]
      });

      try {
        const bundlesPath = `${RNFetchBlob.fs.dirs.DocumentDir}/bundles`;
        logger.info("bundlesPath: ", bundlesPath);
        await unzip(`${bundlesPath}/bundle.zip`, `${bundlesPath}`, 'UTF-8');
        dispatch({
          type: 'SET_LAUNCH_SEQUENCE',
          payload: [
            {
              label: 'Clear old files',
              status: 'success'
            },
            {
              label: 'Download appconfig',
              status: 'success'
            },
            {
              label: 'Download javascript bundle',
              status: 'success'
            },
            {
              label: 'Setup new files',
              status: 'success'
            }
          ]
        });
      } catch (err) {
        logger.error("Failed to unzip files", err)
        dispatch({
          type: 'SET_LAUNCH_SEQUENCE',
          payload: [
            {
              label: 'Clear old files',
              status: 'success'
            },
            {
              label: 'Download appconfig',
              status: 'success'
            },
            {
              label: 'Download javascript bundle',
              status: 'success'
            },
            {
              label: 'Setup new files',
              status: 'error'
            }
          ]
        });
      }
    } else {
      console.error('AppId not found. stopping')
      dispatch({
        type: 'SET_LAUNCH_SEQUENCE',
        payload: [
          {
            label: 'Clear old files',
            status: 'success'
          },
          {
            label: 'Download appconfig',
            status: 'error'
          },
          {
            label: 'Download javascript bundle',
            status: 'error'
          },
          {
            label: 'Setup new files',
            status: 'error'
          }
        ]
      })
    }
  } catch (err) {
    logger.error("Failed for some reason: ", err);
    dispatch({
      type: 'SET_LAUNCH_SEQUENCE',
      payload: [
        {
          label: 'Clear old files',
          status: 'error'
        },
        {
          label: 'Download appconfig',
          status: 'error'
        },
        {
          label: 'Download javascript bundle',
          status: 'error'
        },
        {
          label: 'Setup new files',
          status: 'error'
        }
      ]
    });
  }
}
export function HomePage(props: ScreenProps) {
  const {navigation, route} = props;
  const [state, dispatch] = useReducer(
    reducer,
    {
      appId: '',
      hasError: false,
      errorMessage: '',
      pushLogs: {
        logs: [],
        artefacts: []
      },
      manifest: {
        name: "",
        published: false,
        androidBundleId: null,
        iosBundleId: null,
        forks: []
      },
      launchSequence: [],
      showLaunchSequence: false
    }
  );
  const isFocussed = useIsFocused();

  useEffect(() => {
    initialize(dispatch);
    const linkingHandler = Linking.addEventListener('url', ({url}) => {
      fetchAppId(dispatch, url);
    });

    return () => {
      linkingHandler.remove(); 
    };
  }, [state.appId, isFocussed]);

  const downloadCached = downloadForPreview.bind(null, state, dispatch);
  const downloadUnCached = downloadForPreviewNonCache.bind(null, state, dispatch);

  const hideLaunchSequence = () => {
    dispatch({
      type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY',
      payload: false
    });
  };

  return (
    <HomeCard 
      state={state} 
      onDownload={downloadCached} 
      onNonCacheDownload={downloadUnCached}
      onModalDismiss={hideLaunchSequence}
      onRefresh={() => initialize(dispatch)}
      onScan={() => navigation.push("Scanner")}
    />
  );
}

type HomeCardProps = { 
  state: HomeState; 
  onNonCacheDownload: DownloadNonCacheCodepushCb;
  onDownload: DownloadCodepushCb; 
  onModalDismiss: () => void;
  onRefresh: () => void;
  onScan: () => void;
};
function HomeCard({ state, onDownload, onNonCacheDownload, onModalDismiss, onRefresh, onScan }: HomeCardProps) {
  if (state.appId) {
    return (
      <SafeAreaView>
        <ScrollView style={[layout.flexCol, layout.p2]}>
          <View style={[layout.flexRow, layout.justifyBetween]}>
            <Text style={[text.secondary]}>{state.appId}</Text>
            <Pressable
              onPress={onRefresh}
              style={[buttons.primary]}
            >
              <Text style={[text.accent, text.large]}>Refresh</Text>
            </Pressable>
          </View>
          <LiveApp 
            manifest={state.manifest} 
            onDownload={onDownload}
            onNonCacheDownload={onNonCacheDownload}
          />
          <Versions manifest={state.manifest} />
          <PushLogs logs={state.pushLogs} onDownload={onDownload} />
        </ScrollView>
        <LauncSequenceModal 
          state={state}
          onModalDismiss={onModalDismiss}
        />
      </SafeAreaView>
    );
  } else {
    return (
      <SafeAreaView
        style={[
          layout.flexCol,
          layout.alignCenter,
          layout.p2
        ]}
      >
        <Image 
          style={{
            height: 100
          }}
          resizeMode={'contain'}
          source={require('../assets/logo.png')}
        />
        <View
          style={[layout.mTopBottom]}
        >
          <Text>Scan your QR code to see your app's versions</Text>
        </View>
        <Pressable
          style={{
            borderRadius: 16,
            backgroundColor: '#1060E0',
            minWidth: 80,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
            marginTop: 40
          }}
        >
          <Text
            style={[text.large, {color: 'white'}]}
            onPress={onScan}
          >
            Scan
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }
}

function LauncSequenceModal(props: {state: HomeState, onModalDismiss: () => void}) {
  
  const {state, onModalDismiss} = props;
  const actionItems = state.launchSequence.map(item => {
    let statusIndicator = null;
    if (item.status === 'inprogress') {
      statusIndicator = <ActivityIndicator size="small" />
    } else if (item.status === 'success') {
      statusIndicator = <Text style={[text.safe, text.large]}>✓</Text>;
    } else if (item.status === 'error') {
      statusIndicator = <Text style={[text.danger, text.title]}>˟</Text>;
    } else {
      statusIndicator = <Text style={[text.danger, text.safe]}>䷄</Text>
    }
      return (
        <View 
          key={item.label} 
          style={[layout.flexRow, layout.alignCenter]}
        >
          {statusIndicator}
          <Text style={[text.body, layout.mLeftRight]}>{item.label}</Text>
        </View>
      );
  });

  let sequenceComplete = true;
  for ( let i = 0; i < state.launchSequence.length; ++i)  {
    sequenceComplete = sequenceComplete && state.launchSequence[i].status === 'success';
  }

  let restartButton = null;
  if (sequenceComplete) {
    restartButton = (
      <View 
        style={[layout.p1, layout.fullWidth, layout.flexRow, layout.justifyCenter]}
      >
        <Pressable style={[buttons.primary]} onPress={() => RNRestart.Restart()}>
          <Text style={[text.accent]}>Restart</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Modal 
      visible={state.showLaunchSequence}
      animationType={'slide'}
      presentationStyle={'pageSheet'}
      onRequestClose={onModalDismiss}
    >
      <View style={[layout.fullWidth, layout.fullHeight, layout.flexCol]}>
        <View style={[layout.flexRow, layout.justifyEnd, layout.fullWidth, layout.p1]}>
          <Pressable 
            style={[buttons.primary]}
            onPress={onModalDismiss}
          >
            <Text style={[text.large, text.accent]}>Close</Text>
          </Pressable>
        </View>
        <View style={[layout.p1]}>
          {actionItems}
        </View>
        {restartButton}     
      </View>
    </Modal>
  );
}

function LiveApp(props: { manifest: HomeState['manifest'], onDownload: DownloadCodepushCb, onNonCacheDownload: DownloadNonCacheCodepushCb }) {
  const manifest = props.manifest;

  let publishedState;
  if (manifest.published) {
    publishedState = <Text style={[text.danger]}>PUBLISHED</Text>
  } else {
    publishedState = <Text style={[text.safe]}>IN DEVELOPMENT</Text>
  }

  let renderedForks = [];
  for (let i = 0; i < manifest.forks.length; ++i) {
    const fork = manifest.forks[i];
    renderedForks.push(
      <View
        key={fork.title}
        style={[layout.flexRow, layout.alignCenter, layout.justifyBetween]}
      >
        <Text>{fork.title}</Text>
        <View style={[layout.flexCol, layout.grow]}>
          <View style={[layout.flexRow, layout.grow, layout.justifySpaceEvenly]}>
            <Text>{manifest.androidBundleId || "-"}</Text>
            <Text>{manifest.iosBundleId || "-"}</Text>
            <Text>{fork.publishedCommitId}</Text>
            <Pressable 
              style={[buttons.primary]}
              onPress={() => props.onDownload(fork.publishedCommitId, manifest.iosBundleId, manifest.androidBundleId)}
            >
              <Text style={[text.accent, text.large]}>Download</Text>
            </Pressable>
          </View>
          <View style={[layout.flexRow, layout.grow, layout.justifySpaceEvenly]}>
            <Text>{manifest.androidBundleId || "-"}</Text>
            <Text>{manifest.iosBundleId || "-"}</Text>
            <Text>{fork.mainBranchLatestSave.commitId}</Text>
            <Pressable 
              style={[buttons.primary]}
              onPress={() => props.onNonCacheDownload(fork.mainBranchLatestSave.cdnlink, manifest.iosBundleId, manifest.androidBundleId)}
            >
              <Text style={[text.danger, text.large]}>Download</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[layout.flexCol, border.solid, border.round1, layout.p1, layout.mTopBottom]}
    >
      <Text style={[text.title]}>{manifest.name}</Text>
      {publishedState}
      <View style={[layout.flexRow, layout.alignBaseline]}>
        <Text style={[text.subtitle]}>Forks</Text>
      </View>
      {renderedForks}
    </View>
  );
}

function Versions(props: { manifest: HomeState['manifest'] }) {
  const manifest = props.manifest;

  let renderedVersions = (
    <View>
      <Text>No versions yet!</Text>
    </View>
  );

  return (
    <View
      style={[layout.flexCol, border.solid, border.round1, layout.p1, layout.mTopBottom]}
    >
      <Text style={[text.subtitle]}>Versions</Text>
      {renderedVersions}
    </View>
  );
}

const formatter = Intl.DateTimeFormat("en-us", { dateStyle: 'long' })

function PushLogs(props: { logs: HomeState['pushLogs'], onDownload: DownloadCodepushCb }) {
  const pushLogs = props.logs;
  let renderedLogs;
  if (pushLogs.logs.length === 0) {
    renderedLogs = (<Text>No pushLogs found</Text>);
  } else {
    const prefix = 'Update due to OTA at';
    renderedLogs = (
      <>
        {pushLogs.logs.map((entry, i) => {
          let comment;
          if (entry.comment.startsWith(prefix)) {
            const dateString = entry.comment.slice(prefix.length);
            const formattedDate = formatter.format(new Date(dateString));
            comment = formattedDate;
          } else {
            comment = entry.comment;
          }

          return (
            <View
              key={'pushlog-' + i}
              style={[layout.flexRow, layout.alignCenter, layout.justifyBetween, { borderBottomWidth: 1 }]}
            >
              <Text style={[layout.minW25, layout.maxW25]}>
                {comment}
              </Text>
              <View style={[layout.p1, layout.mLeftRight]}>
                <Text>{entry.androidBundleId || "-"}</Text>
              </View>
              <View style={[layout.p1, layout.mLeftRight]}>
                <Text>{entry.iosBundleId || "-"}</Text>
              </View>
              <View style={[layout.p1, layout.mLeftRight]}>
                <Text>{entry.publishedCommitId || "-"}</Text>
              </View>
              <Button 
                title="Download" 
                onPress={() => props.onDownload(
                  entry.publishedCommitId,
                  entry.iosBundleId,
                  entry.androidBundleId
                )}
              />
            </View>
          );
      })
        }
      </>
    );
  }
  return (
    <View style={[border.solid, border.round1, layout.p1, layout.mTopBottom]}>
      <Text style={[text.subtitle]}>History</Text>
      {renderedLogs}
    </View>
  );
}


