import React, { useEffect, useState, useReducer } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenParams } from '../screenParams';
import { DispatchFcn, HomeState, IAppDraftResponse, IManifestResponse, IFork, HomeAction } from '../types/type';
import { border, buttons, layout, text } from '../styles';
import { unzip } from 'react-native-zip-archive';
import RNFetchBlob from 'rn-fetch-blob';
import { setLocalStorageItem as setItem } from 'apptile-core';

type ScreenProps = NativeStackScreenProps<ScreenParams, 'AppDetail'>;

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

const AppDetail: React.FC<ScreenProps> = ({ route }) => {
  const { appId, forkId, branchId, branchName } = route.params;
  const [appDraft, setAppDraft] = useState<IAppDraftResponse['appDraft'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    fetchManifest(appId);
    fetchAppDraft();
    fetchPushLogs(appId);
  }, [appId, forkId, branchId]);

  async function fetchPushLogs(appId: string) {
    try {
      // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const APPTILE_API_ENDPOINT = 'http://localhost:3000';
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

  async function fetchAppDraft() {
    try {
      setLoading(true);
      // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const APPTILE_API_ENDPOINT = 'http://localhost:3000';
      const response = await fetch(
        `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/fork/${forkId}/branch/${branchId}/PreviewAppDraft`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: IAppDraftResponse = await response.json();
      setAppDraft(data.appDraft);
    } catch (err) {
      console.error('Error fetching app draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch app draft');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLastSavedConfig(appId: string, forkId: number | string) {
    const result = {
      commitId: -1,
      cdnlink: ''
    };
  
    try {
      // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const APPTILE_API_ENDPOINT = 'http://localhost:3000';
      const fetchUrl = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/${forkId}/main/noRedirect`;
      console.log('fetching url', fetchUrl);
      const { url } = await fetch(fetchUrl).then(res => res.json())
      console.log('url', url);
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

  async function fetchManifest(appId: string) {
    try {
      // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const APPTILE_API_ENDPOINT = 'http://localhost:3000';
      const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/manifest`;
      console.log('fetching manifest', url);
      const manifestData: IManifestResponse = await fetch(url).then(res => res.json());
      console.log('manifestData', manifestData);
  
      let manifest: HomeState['manifest'] = {
        name: manifestData.name,
        published: manifestData.published,
        androidBundleId: manifestData.androidBundleId,
        iosBundleId: manifestData.iosBundleId,
        forks: manifestData.forks.map((f: IFork) => {
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
        console.log('mainBranchLatestSave', mainBranchLatestSave);
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

  async function downloadForPreviewNonCache(
    cdnlink: string,
    iosBundleId: number | null,
    androidBundleId: number | null
  ) {
    dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true });
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
        const artefact = state.pushLogs.artefacts.find(asset => {
          return (asset.type === 'ios-jsbundle') && (asset.id === iosBundleId);
        });

        if (artefact) {
          bundleUrl = artefact.cdnlink;
        }

      } else if (Platform.OS === 'android') {
        const artefact = state.pushLogs.artefacts.find(asset => {
          return (asset.type === 'android-jsbundle') && (asset.id === androidBundleId)
        });

        if (artefact) {
          bundleUrl = artefact.cdnlink;
        }
      } else {
        console.error("Unsupported platform!");
      }

      let bundleDownload: any = null;
      if (bundleUrl) {
        console.log("Downloading bundle from: ", bundleUrl);
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
        console.log("bundlesPath: ", bundlesPath);
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
        console.error("Failed to unzip files", err)
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
      console.error("Failed for some reason: ", err);
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
    publishedCommitId: number | null,
    iosBundleId: number | null,
    androidBundleId: number | null
  ) {
    dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true });
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

      const apptileBackendUrl = 'http://localhost:3000';
      if (appId && publishedCommitId) {
        const appconfigUrl = `${apptileBackendUrl}/${appId}/main/main/${publishedCommitId}.json`;
        console.log("Appconfig url: " + appconfigUrl);

        const appConfigDownload = RNFetchBlob.config({
          fileCache: true,
          path: RNFetchBlob.fs.dirs.DocumentDir + '/appConfig.json'
        })
          .fetch('GET', appconfigUrl);

        let bundleUrl = null;
        if (Platform.OS === 'ios') {
          const artefact = state.pushLogs.artefacts.find(asset => {
            return (asset.type === 'ios-jsbundle') && (asset.id === iosBundleId);
          });

          if (artefact) {
            bundleUrl = artefact.cdnlink;
          }

        } else if (Platform.OS === 'android') {
          const artefact = state.pushLogs.artefacts.find(asset => {
            return (asset.type === 'android-jsbundle') && (asset.id === androidBundleId)
          });

          if (artefact) {
            bundleUrl = artefact.cdnlink;
          }
        } else {
          console.error("Unsupported platform!");
        }

        let bundleDownload: any = null;
        if (bundleUrl) {
          console.log("Downloading bundle from: ", bundleUrl);
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
          console.log("bundlesPath: ", bundlesPath);
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
          console.error("Failed to unzip files", err)
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
      console.error("Failed for some reason: ", err);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  const currentFork = state.manifest.forks.find(f => f.id === forkId);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
      <View style={styles.container}>
        <Text style={styles.title}>{state.manifest.name}</Text>
        <Text style={[text.secondary]}>App ID: {appId}</Text>
        <Text style={[text.secondary]}>Fork ID: {forkId}</Text>
        <Text style={[text.secondary]}>Branch ID: {branchId}</Text>
        <Text style={[text.secondary]}>Branch Name: {branchName}</Text>

        {currentFork && currentFork.publishedCommitId ? (
          <View style={[styles.draftContainer, border.solid, border.round1, layout.p1]}>
            <Text style={[text.danger]}>PUBLISHED</Text>
            <View style={[layout.flexRow, layout.alignCenter, layout.justifyBetween]}>
              <Text>{currentFork.title}</Text>
              <View style={[layout.flexCol, layout.grow]}>
                <View style={[layout.flexRow, layout.grow, layout.justifySpaceEvenly]}>
                  <Text>{state.manifest.androidBundleId || "-"}</Text>
                  <Text>{state.manifest.iosBundleId || "-"}</Text>
                  <Text>{currentFork.publishedCommitId}</Text>
                  <Pressable 
                    style={[buttons.primary]}
                    onPress={() => downloadForPreview(
                      currentFork.publishedCommitId,
                      state.manifest.iosBundleId,
                      state.manifest.androidBundleId
                    )}
                  >
                    <Text style={[text.accent, text.large]}>Download</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.draftContainer, border.solid, border.round1, layout.p1]}>
            <Text style={[text.safe]}>No Published Version Live</Text>
          </View>
        )}

        {appDraft && (
          <>
            <Text style={styles.subtitle}>Latest Draft</Text>
            <View style={styles.draftContainer}>
              <Text style={styles.text}>Commit ID: {appDraft.commitId}</Text>
              <Text style={styles.text}>Android Bundle URL: {appDraft.androidBundleUrl || 'Not available'}</Text>
              <Text style={styles.text}>iOS Bundle URL: {appDraft.iosBundleUrl || 'Not available'}</Text>
              <Text style={styles.text}>Navigators Bundle URL: {appDraft.navigatorsBundleUrl || 'Not available'}</Text>
              <Text style={styles.text}>Plugins Bundle URL: {appDraft.pluginsBundleUrl || 'Not available'}</Text>
              <Text style={styles.text}>Created At: {new Date(appDraft.createdAt).toLocaleString()}</Text>
              <Text style={styles.text}>Updated At: {new Date(appDraft.updatedAt).toLocaleString()}</Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    marginBottom: 8,
  },
  draftContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
}); 

export default AppDetail;