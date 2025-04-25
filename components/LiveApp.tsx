import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { DownloadCodepushCb, DownloadNonCacheCodepushCb, HomeState } from '../types/type';
import { border, buttons, layout, text } from '../styles';


const LiveApp = (props: { manifest: HomeState['manifest'], onDownload: DownloadCodepushCb, onNonCacheDownload: DownloadNonCacheCodepushCb }) => {
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

export default LiveApp