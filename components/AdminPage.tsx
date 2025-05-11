import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, ActivityIndicator, Button, Platform, ScrollView, Alert} from 'react-native';
import {getConfigValue, setBundle} from 'apptile-core';
import RNRestart from 'react-native-restart';

type AppManifest = {
  loadingState: "notstarted"|"loading"|"error"|"success",
  data?: {
    appId: number;
    publishedCommitId: number;
    url: string;
    artefacts: {
      id: number;
      type: "ios-jsbundle"|"android-jsbundle";
      tag: string;
      cdnlink: string;
    }
  }
};

type PushLogs = {
  loadingState: "notstarted"|"loading"|"error"|"success",
  logs: Array<{
    id: number;
    appId: number;
    iosBundleId: number;
    androidBundleId: number;
    publishedCommitId: number;
    comment: string;
  }>,
  artefacts: Array<{
    id: number;
    type: "ios-jsbundle"|"android-jsbundle";
    tag: string;
    cdnlink: string;
  }>
};

export default function AdminPage({route}) {
  const [manifest, setManifest] = useState<AppManifest>({
    loadingState: "notstarted",
  });
  const [pushLogs, setPushLogs] = useState<PushLogs>({
    loadingState: "notstarted",
    logs: [],
    artefacts: []
  });

  const appId = route.params.appId;
  const fetchPushlogs = (appId: string) => {
    // https://api.apptile.local/api/v2/app/4de62a28-c347-4628-b41a-9c88b4b54326/pushLogs
    getConfigValue('APPTILE_API_ENDPOINT')
      .then((APPTILE_API_ENDPOINT:string) => {
        const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/pushLogs`;
        return url;
      })
      .then((url) => {
        return fetch(url).then(res => res.json());
      })
      .then((rawPushLogs) => {
        try {
          const pushLogs: PushLogs = {
            loadingState: "success",
            logs: [],
            artefacts: []
          };
          pushLogs.logs = rawPushLogs.logs;
          pushLogs.artefacts = rawPushLogs.artefacts;
          setPushLogs(pushLogs);
        } catch (err) {
          console.error("Failed to parse pushLogs", err);
          setPushLogs({
            loadingState: "error",
            logs: [],
            artefacts: []
          });
        }
      })
      .catch(err => {
        console.error("Error while getting pushLogs", err)
        setPushLogs({
          loadingState: "error",
          logs: [],
          artefacts: []
        });
      })
  }
  const fetchAppManifest = (appId: string) => {
    getConfigValue('APPTILE_UPDATE_ENDPOINT')
      .then(APPTILE_UPDATE_ENDPOINT => {
        const url = `${APPTILE_UPDATE_ENDPOINT}/app/${appId}/main/main/manifest?frameworkVersion=0.17.0`;
        return url;
      })
      .then((url) => {
        fetch(url)
          .then(res => res.json())
          .then(data => {
            try {
              const parsedManifest: AppManifest['data'] = {
                appId: data.appId,
                publishedCommitId: data.publishedCommitId,
                url: data.url,
                artefacts: {
                  id: -1,
                  type: Platform.select({ ios: "ios-jsbundle", android: "android-jsbundle", default: "ios-jsbundle" }),
                  tag: "not obtained",
                  cdnlink: ""
                }
              };

              for (let i = 0; i < data.artefacts.length; ++i) {
                const artefact = data.artefacts[i];
                if (
                  (Platform.OS === "ios" && artefact.type === "ios-jsbundle") ||
                  (Platform.OS === "android" && artefact.type === "android-jsbundle")
                ) {
                  parsedManifest.artefacts.id = artefact.id;
                  parsedManifest.artefacts.type = artefact.type;
                  parsedManifest.artefacts.tag = artefact.tag;
                  parsedManifest.artefacts.cdnlink = artefact.cdnlink;
                  break;
                }
              }

              setManifest({
                loadingState: "success",
                data: parsedManifest
              });
            } catch (err) {
              console.error("Failed to parse manifest", err);
              setManifest({
                loadingState: "error"
              });
            }
          })
          .catch(err => {
            console.error("Failed to get manifest", err);
            setManifest({
              loadingState: "error",
            });
          })
      })
    
  }

  useEffect(() => {
    fetchAppManifest(appId);
    fetchPushlogs(appId);
  }, [appId]);

  const applyPushFromLog = useCallback((log: PushLogs['logs'][0]) => {
    const codepushBundleId = Platform.select({
      ios: log.iosBundleId,
      android: log.androidBundleId
    });

    let codepushBundleLink: null|string = null;
    if (codepushBundleId) {
      const bundle = pushLogs.artefacts.find(it => it.id === codepushBundleId);
      if (bundle) {
        codepushBundleLink = bundle.cdnlink;
      }
    }

    const appconfigUrl = `https://dev-appconfigs.apptile.io/${appId}/main/main/${log.publishedCommitId}.json`;
    setBundle(codepushBundleLink, appconfigUrl)
      .then(() => {
        Alert.alert('Codepush downloaded!', 'Click apply to restart', [
          {
            text: 'Apply',
            onPress: () => RNRestart.restart(),
          },
          {
            text: 'Cancel',
            onPress: () => console.log('Cancel Pressed'),
            style: 'cancel',
          },
        ]);     
      })
      .catch((err: any) => {
        console.error("could not set bundle", err);
      })
  }, [pushLogs, appId]);

  const resetToLatest = () => {};

  let renderedManifest = <Text>Manifest</Text>;
  if (manifest.loadingState === "error") {
    renderedManifest = <Text>Uh oh! Some error ocurred</Text>;
  } else if (manifest.loadingState === "loading") {
    renderedManifest = <ActivityIndicator size="large"/>;
  } else if (manifest.loadingState === "notstarted") {
    renderedManifest = <Text>Click to fetch manifest</Text>
  } else if (manifest.data) {
    renderedManifest = (<View style={{flexDirection: "row", justifyContent: "space-between", borderWidth: 1}}>
      <View>
        <Text>Published commit: {manifest.data.publishedCommitId}</Text>
        <Text>codepush: {manifest.data.artefacts.id}: {manifest.data.artefacts.tag}</Text>
      </View>
      <Button title="Reset to latest" onPress={resetToLatest}></Button>
    </View>);
  }

  let renderedPushLogs = [<Text>Push logs</Text>];
  if (pushLogs.loadingState === "error") {
    renderedPushLogs = [<Text>Uh oh! Some error ocurred</Text>];
  } else if (manifest.loadingState === "loading") {
    renderedPushLogs = [<ActivityIndicator size="large"/>];
  } else if (manifest.loadingState === "notstarted") {
    renderedPushLogs = [<Text>Click to fetch pushLogs</Text>];
  } else {
    renderedPushLogs = pushLogs.logs.map(log => (<View style={{flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1}}>
      <View>
        <Text style={{maxWidth: "85%"}}>comment: {log.comment}</Text>
        <Text>ios: {log.iosBundleId}</Text>
        <Text>android: {log.androidBundleId}</Text>
        <Text>config: {log.publishedCommitId}</Text>
      </View>
      <Button title="apply" onPress={() => applyPushFromLog(log)}></Button>
    </View>));
  }

  return (
    <ScrollView>
      <Text style={{fontSize: 20, fontWeight: "500"}}>Current manifest</Text>
      {renderedManifest}
      <Button 
        title="Load/Reload"
        onPress={() => {fetchAppManifest(appId); fetchPushlogs(appId)}}
      >
      </Button>
      <Text style={{fontSize: 20, fontWeight: "500"}}>Push logs</Text>
      <Text>number of logs: {pushLogs.logs.length}</Text>
      {renderedPushLogs}
    </ScrollView>
  );
}