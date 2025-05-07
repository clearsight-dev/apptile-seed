import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { setLocalStorageItem as setItem } from 'apptile-core';
import React, { useEffect, useReducer, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RNRestart from 'react-native-restart';
import { SvgXml } from 'react-native-svg';
import { unzip } from 'react-native-zip-archive';
import RNFetchBlob from 'rn-fetch-blob';
import { ScreenParams } from '../screenParams';
import { HomeAction, HomeState, IAppDraftResponse, IFork } from '../types/type';
import {
  fetchAppDraftApi,
  fetchBranchesApi,
  fetchCommitApi,
  fetchLastSavedConfigApi,
  fetchManifestApi,
  fetchPushLogsApi,
  ICommitResponse
} from '../utils/api';
import { getFormattedDate } from '../utils/commonUtil';
import AppInfo from './AppInfo';
import LauncSequenceModal from './LauncSequenceModal';
import StyledButton from './StyledButton';
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
  const { appId, forkId, branchName, forkName, branchTitle } = route.params;
  const [appDraft, setAppDraft] = useState<IAppDraftResponse['appDraft'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);
  const [draftPreviewLoading, setDraftPreviewLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [draftCommitURL, setDraftCommitURL] = useState('');
  const [liveCommitData, setLiveCommitData] = useState<ICommitResponse | null>(null);
  const [isLatestPreviewActive, setIsLatestPreviewActive] = useState(false);
  const [isDraftPreviewActive, setIsDraftPreviewActive] = useState(false);
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


  async function logLiveBranchInfo() {
    try {
      // 1. Find the current fork
      const currentFork = state.manifest.forks.find(f => f.id === forkId);
      if (!currentFork || !currentFork.publishedCommitId) {
        
        return;
      }
      // 2. Get publishedCommitId
      const publishedCommitId = currentFork.publishedCommitId;
      // 3. Fetch commit details
      const commitDetails = await fetchCommitApi(publishedCommitId);
      setLiveCommitData(commitDetails);
      const liveBranchId = commitDetails.branchId;
      // 4. Fetch branch list
      const branchesData = await fetchBranchesApi(appId, forkId);
      // 5. Find the live branch and the branch from props
      const liveBranch = branchesData.branches.find(b => b.id === liveBranchId);
      const propBranch = branchesData.branches.find(b => b.branchName === branchName);
      if (liveBranch) {
        
      } else {
        
      }
      if (propBranch) {
        
        
        if (liveBranch && propBranch.id === liveBranch.id) {
          
          setIsLive(true);
        }
      } else {
        
      }
    } catch (err) {
      console.error('Error in logLiveBranchInfo:', err);
    }
  }

  useEffect(() => {
    if (appId && forkId) {
      fetchManifest(appId);
      fetchAppDraft(forkId);
      fetchPushLogs(appId);
    }
  }, [appId, forkId, branchName]);

  useEffect(() => {
    if (appId && forkId && state.manifest.forks.length > 0 && branchName) {
      logLiveBranchInfo();
    }
  }, [appId, forkId, branchName, state.manifest.forks]);

  async function fetchPushLogs(appId: string) {
    try {
      const pushLogs = await fetchPushLogsApi(appId);
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

  async function fetchAppDraft(forkId: number) {
    try {
      setLoading(true);
      const previewAppDraftData = await fetchAppDraftApi(appId, forkId, branchName);
      if ((previewAppDraftData as any).notFound) {
        setAppDraft(null);
        return;
      } else if ('appDraft' in previewAppDraftData) {
        setAppDraft((previewAppDraftData as IAppDraftResponse).appDraft);
        const getCommitURL = await fetchCommitApi((previewAppDraftData as IAppDraftResponse).appDraft.commitId);
        setDraftCommitURL(getCommitURL.url);
      }

    } catch (err) {
      console.error('Error fetching app draft:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLastSavedConfig(appId: string, forkId: number | string, branchName: string) {
    const result = {
      commitId: -1,
      cdnlink: ''
    };
    try {
      const savedConfigData = await fetchLastSavedConfigApi(appId, forkId, branchName);
      const url = savedConfigData.url;
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
      const manifestData = await fetchManifestApi(appId);
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
        const mainBranchLatestSave = await fetchLastSavedConfig(appId, fork.id, branchName);
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
    setDraftPreviewLoading(true);
    // dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true });
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
        console.log('bundlesPath', bundlesPath);
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
        RNRestart.Restart()
      } catch (err) {
        setDraftPreviewLoading(false);
        console.error('[downloadForPreviewNonCache] Failed to unzip files', err)
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
      setDraftPreviewLoading(false);
      console.error('[downloadForPreviewNonCache] Failed for some reason: ', err);
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
    setLivePreviewLoading(true);
    // dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true });
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

      // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const APPTILE_API_ENDPOINT = 'http://localhost:3000';
      if (appId && publishedCommitId) {
        const appconfigUrl = `${APPTILE_API_ENDPOINT}/${appId}/${forkName}/${branchName}/${publishedCommitId}.json`;
        

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
          setLivePreviewLoading(false);
          console.error("Unsupported platform!");
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
          RNRestart.Restart()
        } catch (err) {
          setLivePreviewLoading(false);
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
        setLivePreviewLoading(false);
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
      setLivePreviewLoading(false);
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

  // if (error) {
  //   return (
  //     <View style={styles.container}>
  //       <Text style={styles.errorText}>Error: {error}</Text>
  //     </View>
  //   );
  // }

  const currentFork = state.manifest.forks.find(f => f.id === forkId);
  
  const downloadFailedIcon = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10.56" stroke="#FF0000" stroke-width="0.88"/><path d="M12.1071 4.76944L11.6636 12.6736H10.333L9.87367 4.76944H12.1071ZM9.84199 14.9546C9.84199 14.321 10.3489 13.7824 10.9825 13.7824C11.6319 13.7824 12.1546 14.321 12.1546 14.9546C12.1546 15.5882 11.6319 16.1109 10.9825 16.1109C10.3489 16.1109 9.84199 15.5882 9.84199 14.9546Z" fill="#FF0000"/></svg>`;
  const infoIcon = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10.56" stroke="#1060E0" stroke-width="0.88"/><path d="M11 7.5V11.5M11 14.5H11.01" stroke="#1060E0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return (
    <>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <AppInfo appName={state.manifest.name} forkName={currentFork?.title} branchName={branchTitle} showLiveBadge={isLive} />
        <View style={styles.container}>
          <View style={styles.sectionContainer}>
            {
              (currentFork?.publishedCommitId && isLive) &&
              <>
                <Text style={styles.sectionTitle}>Latest</Text>
                <View style={styles.versionCard}>
                   
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={styles.versionLabel}>Version</Text>
                    {/* Info/Failed Download Status */}
                    {isLatestPreviewActive && livePreviewLoading && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true })}
                        style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#1060E0', fontWeight: '600', fontSize: 14, marginRight: 6 }}>
                          Info
                        </Text>
                        <SvgXml xml={infoIcon} width={22} height={22} />
                      </TouchableOpacity>
                    )}
                    {/* Failed Download Status */}
                    {isLatestPreviewActive && state.launchSequence.some(item => item.status === 'error') && (
                      <TouchableOpacity
                        onPress={() => dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true })}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#FF2D1A', fontWeight: '600', fontSize: 14, marginRight: 6 }}>
                          Failed
                        </Text>
                        <SvgXml xml={downloadFailedIcon} width={22} height={22} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.versionDate}>
                      {liveCommitData?.createdAt ? getFormattedDate(liveCommitData?.createdAt) : ''}
                    </Text>
                  <StyledButton
                    loading={livePreviewLoading}
                    disabled={livePreviewLoading}
                    title="Preview"
                    onPress={() => {
                      setIsLatestPreviewActive(true);
                      setIsDraftPreviewActive(false);
                      downloadForPreview(
                        currentFork.publishedCommitId,
                        state.manifest.iosBundleId,
                        state.manifest.androidBundleId
                      )
                    }}
                    style={styles.selectButton}
                  />
                </View>
              </>
            }
            <Text style={styles.sectionTitle}>Draft</Text>
            <View style={styles.versionCard}>
              {
                appDraft ?
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={styles.versionLabel}>Version</Text>
                      {/* Info/Failed Download Status */}
                      {isDraftPreviewActive && draftPreviewLoading && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true })}
                          style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: '#1060E0', fontWeight: '600', fontSize: 14, marginRight: 6 }}>
                            Info
                          </Text>
                          <SvgXml xml={infoIcon} width={22} height={22} />
                        </TouchableOpacity>
                      )}
                      {/* Failed Download Status */}
                      {isDraftPreviewActive && state.launchSequence.some(item => item.status === 'error') && (
                        <TouchableOpacity
                          onPress={() => dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: true })}
                          activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: '#FF2D1A', fontWeight: '600', fontSize: 14, marginRight: 6 }}>
                            Failed
                          </Text>
                          <SvgXml xml={downloadFailedIcon} width={22} height={22} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.versionDate}>
                      {appDraft?.createdAt ? getFormattedDate(appDraft.createdAt) : ''}
                    </Text>
                    <LauncSequenceModal
                      state={state}
                      onModalDismiss={() => dispatch({ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY', payload: false })}
                    />
                    <StyledButton
                      loading={draftPreviewLoading}
                      disabled={draftPreviewLoading}
                      variant="outline"
                      title="Preview"
                      onPress={() => {
                        setIsDraftPreviewActive(true);
                        setIsLatestPreviewActive(false);
                        downloadForPreviewNonCache(
                          draftCommitURL as string,
                          state.manifest.iosBundleId,
                          state.manifest.androidBundleId
                        )
                      }}
                      style={styles.selectButton}
                    />
                  </>
                  :
                  <Text style={styles.versionLabel}>No Draft is saved</Text>
              }
            </View>
          </View>
        </View>
      </ScrollView>
    </>
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
  selectButton: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    alignSelf: 'center',
  },
  sectionContainer: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: '#2D2D2D',
    fontFamily: "Circular Std",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "400",
    marginBottom: 8,
    marginLeft: 6,
  },
  versionCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
  },
  versionLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    fontWeight: '500',
    marginBottom: 2,
  },
  versionDate: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
    marginBottom: 18
  },
  previewButtonFilled: {
    backgroundColor: '#295DDB',
    borderRadius: 32,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  previewButtonFilledText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewButtonOutline: {
    borderWidth: 2,
    borderColor: '#295DDB',
    borderRadius: 32,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  previewButtonOutlineText: {
    color: '#295DDB',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppDetail;