import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getConfigValue,
  getLocalStorageItem as getItem,
  setLocalStorageItem as setItem
} from 'apptile-core';
import React, { useEffect, useReducer } from 'react';
import { Linking, Platform } from 'react-native';
import { unzip } from 'react-native-zip-archive';
import RNFetchBlob from 'rn-fetch-blob';
import { ScreenParams } from '../screenParams';
import { HomeState, IAppForksResponse, IAppFork, DispatchFcn, HomeAction, IManifestResponse } from '../types/type';
import HomeCard from './HomeCard';
import { setLaunchSequenceSetupFileError, setLaunchSequenceSuccess } from '../constants/constant';

// TODO(gaurav) when artefactId is -1 set it back to null after api call
type ScreenProps = NativeStackScreenProps<ScreenParams, 'PreviewHome'>;

type NavigationProp = NativeStackNavigationProp<ScreenParams, 'PreviewHome'>;

async function fetchAppId(dispatch: DispatchFcn, url?: string): Promise<null | string> {
  const tempAppId = 'cda38d9c-403f-4a47-a8ce-a81dd5da9eb3';
  let appId: string | null = null;
  try {
    appId = tempAppId;
    let initialUrl = url || null;
    if (!initialUrl) {
      initialUrl = await Linking.getInitialURL();
    }

    if (!appId) {
      if (initialUrl && initialUrl.startsWith('apptilepreview://locktoapp/')) {
        appId = tempAppId;
        try {
          await setItem("appId", tempAppId);
        } catch (err) {
          dispatch({
            type: 'SET_ERROR',
            payload: err?.toString() || "noerror"
          });
        }
      }
    } else {
      if (initialUrl && initialUrl.startsWith('apptilepreview://unlock')) {
        appId = tempAppId;
        await setItem('appId', tempAppId);
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
    payload: tempAppId
  });
  return tempAppId;
}

async function fetchPushLogs(appId: string, dispatch: DispatchFcn) {
  try {
    // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const APPTILE_API_ENDPOINT = 'https://api.apptile.local';
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
    // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const APPTILE_API_ENDPOINT = 'https://api.apptile.local';
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/manifest`;
    const manifestData: IManifestResponse = await fetch(url).then(res => res.json());

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

async function fetchForks(appId: string, dispatch: DispatchFcn, navigation: NavigationProp) {
  try {
    // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const APPTILE_API_ENDPOINT = 'http://localhost:3000';
    console.log('Fetching forks for appId:', appId,`${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/forks`);
    const response = await fetch(`${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/forks`);
    console.log('Response:', response);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: IAppForksResponse = await response.json();
    
    if (data.forks.length > 1) {
      navigation.navigate('Fork', {
        appId: appId,
        forks: data.forks
      });
    } else {
      navigation.navigate('AppDetail', {
        appId: appId,
        forkId: data.forks[0].id
      });
    }
  } catch (error) {
    console.error('Error fetching forks:', error);
  }
}

async function fetchLastSavedConfig(appId: string, forkId: number | string) {
  const result = {
    commitId: -1,
    cdnlink: ''
  };

  try {
    // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const APPTILE_API_ENDPOINT = 'https://api.apptile.local';
    const { url } = await fetch(`${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/${forkId}/main/noRedirect`).then(res => res.json())
    const commitId = url.match(/\/([0-9]+)\.json$/);
    if (commitId && commitId[1]) {
      result.cdnlink = url;
      result.commitId = parseInt(commitId[1]);
    }
  } catch (err) {
    console.error("Failed to get the lastest save");
  }
  return result;
}

async function initialize(dispatch: DispatchFcn, navigation: NavigationProp) {
  const appId = await fetchAppId(dispatch);
  if (appId) {
    await Promise.all([
      fetchPushLogs(appId, dispatch),
      fetchManifest(appId, dispatch),
      fetchForks(appId, dispatch, navigation)
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
      result = { ...state, launchSequence: action.payload };
      break;
    case 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY':
      result = { ...state, showLaunchSequence: action.payload };
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
  dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true });
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
  publishedCommitId: number | null,
  iosBundleId: number | null,
  androidBundleId: number | null) {
  // check for existing bundle and config and delete them
  dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true });
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
        const inBundles = await RNFetchBlob.fs.ls(bundlesPath);
        console.log('contents of bundles: ', inBundles);

        await unzip(`${bundlesPath}/bundle.zip`, `${bundlesPath}`, 'UTF-8');
        dispatch(setLaunchSequenceSuccess);
      } catch (err) {
        logger.error("Failed to unzip files", err)
        dispatch(setLaunchSequenceSetupFileError);
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
  const { navigation, route } = props;
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
    initialize(dispatch, navigation);
    const linkingHandler = Linking.addEventListener('url', ({ url }) => {
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
      onRefresh={() => initialize(dispatch, navigation)}
      onScan={() => navigation.push("Scanner")}
    />
  );
}