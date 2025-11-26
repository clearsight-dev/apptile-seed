import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { RNCamera } from 'react-native-camera';
import { useApptileWindowDims, Icon } from 'apptile-core';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { goBack, navigateToScreen } from 'apptile-core';
import { styles } from './styles';

export function ReactComponent({ model }) {
    const id = model.get('id');
    const { width, height } = useApptileWindowDims();
    const dispatch = useDispatch();
    const cameraRef = useRef(null);
    const [flashMode, setFlashMode] = useState(RNCamera.Constants.FlashMode.off);
    const [cameraType, setCameraType] = useState(RNCamera.Constants.Type.back);
    const appState = useSelector(
        state => state.appModel.values.getIn(['appState', 'value']),
        shallowEqual
    );

    const handleBack = () => {
        goBack();
    };

    const handleCapture = async () => {
        if (cameraRef.current) {
            try {
                const options = {
                    quality: 0.3,
                    base64: false,
                    pauseAfterCapture: false,
                    width: 800,
                    fixOrientation: true,
                };
                const data = await cameraRef.current.takePictureAsync(options);

                // Estimate memory usage
                if (data.width && data.height) {
                    const memoryMB = ((data.width * data.height * 4) / (1024 * 1024)).toFixed(2);
                }

                // Get current appState
                const currentAppState = appState || {};

                // Store photo URI in global state
                dispatch({
                    type: 'PLUGIN_MODEL_UPDATE',
                    payload: {
                        changesets: [{
                            selector: ['appState', 'value'],
                            newValue: {
                                ...currentAppState,
                                capturedPhoto: data.uri,
                            }
                        }],
                        runOnUpdate: true
                    },
                });

                // Navigate to report detail screen
                dispatch(navigateToScreen('ReportDetailScreen', {}));
            } catch (error) {
                Alert.alert('Error', 'Failed to capture photo');
            }
        }
    };

    const toggleFlash = () => {
        setFlashMode(prevMode =>
            prevMode === RNCamera.Constants.FlashMode.off
                ? RNCamera.Constants.FlashMode.on
                : RNCamera.Constants.FlashMode.off
        );
    };

    const toggleCamera = () => {
        setCameraType(prevType =>
            prevType === RNCamera.Constants.Type.back
                ? RNCamera.Constants.Type.front
                : RNCamera.Constants.Type.back
        );
    };

    return (
        <View
            nativeID={'rootElement-' + id}
            style={[styles.container, { width, height }]}
        >
            <RNCamera
                ref={cameraRef}
                style={styles.camera}
                type={cameraType}
                flashMode={flashMode}
                captureAudio={false}
                androidCameraPermissionOptions={{
                    title: 'Permission to use camera',
                    message: 'We need your permission to use your camera',
                    buttonPositive: 'Ok',
                    buttonNegative: 'Cancel',
                }}
            >
                <View style={styles.topControls}>
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.controlButton}
                        nativeID="camerascreen-TouchableOpacity-BackButton"
                    >
                        <Icon iconType="MaterialIcons" name="close" size={32} color="#ffffff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={toggleFlash}
                        style={styles.controlButton}
                        nativeID="camerascreen-TouchableOpacity-FlashButton"
                    >
                        <Icon
                            iconType="MaterialIcons"
                            name={flashMode === RNCamera.Constants.FlashMode.on ? 'flash-on' : 'flash-off'}
                            size={32}
                            color="#ffffff"
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.bottomControls}>
                    <View style={styles.bottomControlsInner}>
                        <TouchableOpacity
                            onPress={toggleCamera}
                            style={styles.sideButton}
                            nativeID="camerascreen-TouchableOpacity-FlipButton"
                        >
                            <Icon iconType="MaterialIcons" name="flip-camera-ios" size={32} color="#ffffff" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleCapture}
                            style={styles.captureButton}
                            nativeID="camerascreen-TouchableOpacity-CaptureButton"
                        >
                            <View style={styles.captureButtonInner} />
                        </TouchableOpacity>
                        <View style={styles.sideButton} />
                    </View>
                </View>
            </RNCamera>
        </View>
    );
}



export const WidgetConfig = {
    primaryColor: '',
    appTitle: '',
};

export const WidgetEditors = [];

export const PropertySettings = [];
