import React, {useEffect} from 'react';
import {View, NativeModules, StyleSheet} from 'react-native';
import Video from 'react-native-video';

const {VideoPIPModule} = NativeModules;

export default function VideoPIPActivity() {
  useEffect(() => {
    console.log('[VideoPIPActivity] Component mounted, entering PiP mode');
    // Enter PiP mode immediately with video dimensions (9:16 aspect ratio)
    if (VideoPIPModule) {
      VideoPIPModule.enterPictureInPictureMode(180, 320);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.videoWrapper}>
        <Video
          source={{uri: 'https://live.apptile.io/06ff4192-8d22-43a6-8663-36864deaa42d/playlist.m3u8'}}
          resizeMode="contain"
          style={styles.video}
          paused={false}
          viewType={0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ff0000',
    overflow: 'hidden',
  },
  videoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

