import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ActivityIndicator, 
  Alert, 
  Dimensions, 
  StyleSheet,
  Platform
} from 'react-native';
import { 
  Camera, 
  CameraRuntimeError, 
  useCameraDevice, 
  useCodeScanner 
} from 'react-native-vision-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import _ from 'lodash';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import { setLocalStorageItem as setItem } from 'apptile-core';
import {ScreenParams} from '../screenParams';

type ScannerProps = NativeStackScreenProps<ScreenParams, 'Scanner'>;

export function Scanner(props: ScannerProps) {
  const [isDownloading, setIsDownloading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [codeScanned, setCodeScanned] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const camera = useRef<Camera>(null);
  // Debounced function to handle scan result
  const handleScan = _.debounce((codes) => {
    if (!isFocused || (navigation.getState()?.routes ?? []).slice(-1)[0].name === 'PreviewHome') {
      return; // Don't execute if navigation is already at Home
    }

    const appIdMatch = (codes[0]?.value ?? "").match(/appId=(.*)&appName/);
    if (appIdMatch && appIdMatch[1]) {
      setItem('appId', appIdMatch[1]).then(() => {
        logger.info("Navigating back");
        setTimeout(() => {
          navigation.goBack();
        }, 500)
      });
    } else {
      setCodeScanned(codes[0]?.value || "nothing");
    }
  }, 500, { leading: true, trailing: false });
  

  // Request camera permissions on mount
  useEffect(() => {
    async function checkPermissions() {
      let status;
      if (Platform.OS === 'ios') {
        status = await check(PERMISSIONS.IOS.CAMERA);
        if (status !== RESULTS.GRANTED) {
          status = await request(PERMISSIONS.IOS.CAMERA);
        }
      } else {
        status = await check(PERMISSIONS.ANDROID.CAMERA);
        if (status !== RESULTS.GRANTED) {
          status = await request(PERMISSIONS.ANDROID.CAMERA);
        }
      }
      if (status === RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        Alert.alert("Camera permission not granted");
      }
      setIsDownloading(false);
    }
    checkPermissions();
  }, []);

  // Get the back camera device
  const device = useCameraDevice('back');

  // Set up the code scanner using the built-in hook
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleScan,
  });

  // Optional: Handle camera errors
  const onError = (error: CameraRuntimeError) => {
    console.error('Camera error:', error);
    Alert.alert('Camera error', error.message);
  };

  // Calculate dimensions for the QR overlay box
  const screenWidth = Dimensions.get('screen').width;
  const screenHeight = Dimensions.get('screen').height;
  const qrBoxWidth = Math.min(screenWidth * 0.8, 400);
  const qrBoxTop = (screenHeight - qrBoxWidth) / 2;
  const qrBoxLeft = (screenWidth - qrBoxWidth) / 2;

  if (isDownloading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="white" />
        <Text style={{ color: 'white' }}>Downloading...</Text>
      </View>
    );
  }

  if (!hasPermission || !device) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: 'white' }}>No camera permission or device available</Text>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <Camera
        ref={camera}
        style={styles.fullScreen}
        device={device}
        isActive={true}
        onError={onError}
        codeScanner={codeScanner}
      />
      {/* Overlay for the scanning box */}
      <View
        style={[
          styles.qrOverlay,
          {
            top: qrBoxTop,
            left: qrBoxLeft,
            width: qrBoxWidth,
            height: qrBoxWidth,
          },
        ]}
      />
      {/* Display scanned result */}
      {codeScanned && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Scanned: {codeScanned}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    position: 'absolute',
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#1060E0',
  },
  resultContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
  },
  resultText: {
    color: 'white',
    fontSize: 16,
  },
});

export default Scanner;

