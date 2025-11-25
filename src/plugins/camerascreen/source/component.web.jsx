import React, { useRef, useState, useEffect } from 'react';
import { useApptileWindowDims, Icon, goBack } from 'apptile-core';
import { useDispatch } from 'react-redux';

export function ReactComponent({ model }) {
  const id = model.get('id');
  const { width, height } = useApptileWindowDims();
  const dispatch = useDispatch();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [flashMode, setFlashMode] = useState(false);
  const [cameraType, setCameraType] = useState('user'); // 'user' for front, 'environment' for back
  const [error, setError] = useState(null);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [cameraType]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraType === 'user' ? 'user' : 'environment' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('[CAMERA] Error accessing camera:', err);
      setError('Failed to access camera. Please grant camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleBack = () => {
    dispatch(goBack());
  };

  const handleCapture = async () => {
    if (videoRef.current && canvasRef.current) {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        console.log('[CAMERA] Photo captured');

        // Show success message
        alert('Photo captured successfully!');
        handleBack();
      } catch (error) {
        console.error('[CAMERA] Error capturing photo:', error);
        alert('Failed to capture photo');
      }
    }
  };

  const toggleFlash = () => {
    // Flash not supported in web browsers via MediaDevices API
    setFlashMode(prev => !prev);
    alert('Flash is not supported in web browsers');
  };

  const toggleCamera = () => {
    setCameraType(prevType => prevType === 'user' ? 'environment' : 'user');
  };

  return (
    <div
      id={'rootElement-' + id}
      style={{
        width,
        height,
        position: 'relative',
        backgroundColor: '#000000',
        overflow: 'hidden',
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top Controls */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px',
          paddingTop: '50px',
        }}
      >
        <button
          onClick={handleBack}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon iconType="MaterialIcons" name="close" size={32} color="#ffffff" />
        </button>

        <button
          onClick={toggleFlash}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon
            iconType="MaterialIcons"
            name={flashMode ? 'flash-on' : 'flash-off'}
            size={32}
            color="#ffffff"
          />
        </button>
      </div>

      {/* Bottom Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          padding: '0 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Flip Camera Button */}
          <button
            onClick={toggleCamera}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Icon iconType="MaterialIcons" name="flip-camera-ios" size={32} color="#ffffff" />
          </button>

          {/* Capture Button */}
          <button
            onClick={handleCapture}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#ffffff',
              border: '4px solid rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: '#ffffff',
              }}
            />
          </button>

          {/* Spacer for symmetry */}
          <div style={{ width: 50, height: 50 }} />
        </div>
      </div>
    </div>
  );
}



export const WidgetConfig = {
    primaryColor: '',
    appTitle: '',
};

export const WidgetEditors = [];

export const PropertySettings = [];
