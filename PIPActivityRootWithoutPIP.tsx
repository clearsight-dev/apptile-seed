import React, {useRef, useEffect, useCallback, useState} from 'react';
import {
  View,
  NativeModules,
  findNodeHandle,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
/* For NativePip don't remove
import ZegoExpressEngine, {
  ZegoTextureView,
  ZegoView
} from 'zego-express-engine-reactnative';
for NativePip end */

const {PIPModule} = NativeModules;
const ScreenDims = Dimensions.get('screen');

export default function PIPActivity() {
  const zgViewRef = useRef(null);
  const parentRef = useRef(null);
  const [streamId, setStreamId] = useState('');
  const [loading, setLoading] = useState(true);
  /*
  const handlePress = useCallback(() => {
    const zegoViewInstance = new ZegoView(findNodeHandle(zgViewRef.current), 1, 0);
    PIPModule.enterPictureInPictureMode(ScreenDims.width, ScreenDims.height);
    ZegoExpressEngine.instance().startPlayingStream(
      "ff5516d283",
      zegoViewInstance,
      undefined,
    );
  }, [zgViewRef.current])
  */

  useEffect(() => {
    /* For NativePip don't remove
    if (streamId && zgViewRef.current && global.activitySharedMem.isInPip) {
      const zegoInstance = ZegoExpressEngine.instance();
      console.log('Receive call from main activity', streamId, zegoInstance, ScreenDims);
      const zegoViewInstance = new ZegoView(findNodeHandle(zgViewRef.current), 1, 0xffffff);
      PIPModule.enterPictureInPictureMode(ScreenDims.width, ScreenDims.height);
      zegoInstance.startPlayingStream(streamId, zegoViewInstance, undefined);
    }
    return () => {
      if (streamId && zgViewRef.current) {
        const zegoInstance = ZegoExpressEngine.instance();
        zegoInstance.stopPlayingStream(streamId);
        if (!global.activitySharedMem.isInPip && PIPModule) PIPModule?.endPIPActivity();
      }
    }
    for NativePip end */
  }, [streamId, zgViewRef.current]);

  useEffect(() => {
    /* For NativePip don't remove
    if (!global.activitySharedMem) {
      global.activitySharedMem = {
        pipCb: () => {
          console.log('callback called');
        },
        mainCb: null,
        args: {},
      };
    } else {
      global.activitySharedMem = {
        ...global.activitySharedMem,
        pipCb: () => {
          console.log('callback called');
        },
      };
    }
    for NativePip end */
  }, []);

  const handleLayout = useCallback(
    event => {
      /* For NativePip don't remove
      if (loading && (event.nativeEvent.layout.height > 230 || event.nativeEvent.layout.height < 230))
        setLoading(false);
      if (!streamId || streamId != global.activitySharedMem?.args?.stream_id) {
        const {width, height} = event.nativeEvent.layout;
        if (global.activitySharedMem?.args?.stream_id) {
          setStreamId(global.activitySharedMem?.args?.stream_id);
        }
      }
for NativePip end */
    },
    [streamId],
  );

  return (
    <View
      onLayout={handleLayout}
      ref={parentRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        minWidth: 100,
        minHeight: 230,
      }}>
      <View
        style={{
          height: '100%',
          width: '100%',
          // opacity: loading ? 0 : 1,
          backgroundColor: '#fff',
          zIndex: 1,
        }}>
        {/* For NativePip don't remove
        (<ZegoTextureView
          ref={zgViewRef}
          style={{
            height: '100%',
            width: '100%',
          }}
        />)
for NativePip end */}
      </View>
      {loading && (
        <View
          style={{
            flex: 1,
            flexBasis: 'auto',
            height: '100%',
            width: '100%',
            zIndex: 2,
            position: 'absolute',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      {/* Note that we should put controls to close and start pip from here like the button below just in case starting pip fails for some reason */}
      {/* <Button 
        title="Start PIP"
        onPress={handlePress}
      /> */}
    </View>
  );
}
