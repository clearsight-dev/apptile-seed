import React, {useEffect, useState, useRef} from 'react';
import {Platform, View, StyleSheet, Modal, Image, NativeModules} from 'react-native';

const {RNApptile} = NativeModules;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export let hideJSSplashScreen: () => void;
export let showJSSplashScreen: () => void;

let isSplashHiddenAtStart = false;

// Default minimum splash duration in milliseconds
const DEFAULT_MIN_SPLASH_DURATION = 1000;

// Helper function to check if the image source is a GIF
const isGifSource = (source: any): boolean => {
  if (!source) {
    return false;
  }

  // For require() sources, check the uri property
  if (typeof source === 'object' && source.uri) {
    return source.uri.toLowerCase().endsWith('.gif');
  }

  // For direct require() sources, we need to check the module path
  // This is a heuristic approach since require() returns a number in production
  if (typeof source === 'number') {
    // In this case, we can't directly determine the file type
    // The caller should pass metadata or we rely on the file being loaded
    return false;
  }

  return false;
};

// Estimate GIF duration based on typical splash screen GIFs (2-3 seconds)
// This is a fallback since we can't programmatically get GIF duration in React Native
const ESTIMATED_GIF_DURATION = 3000;

const JSSplash: React.FC<{
  children?: React.ReactNode;
  splashImageSource?: any;
  minSplashDuration?: number;
  isGif?: boolean;
}> = ({
  children,
  splashImageSource,
  minSplashDuration = DEFAULT_MIN_SPLASH_DURATION,
  isGif: isGifProp,
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isHidden, setIsHidden] = useState(isSplashHiddenAtStart);
  const hideRequestedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  // Check if the splash image is a GIF
  // Prefer the explicit prop, fallback to detection
  const isGif = isGifProp !== undefined ? isGifProp : isGifSource(splashImageSource);

  useEffect(() => {
    startTimeRef.current = Date.now();

    hideJSSplashScreen = () => {
      hideRequestedRef.current = true;

      const elapsed = Date.now() - startTimeRef.current;
      const remainingMinDuration = Math.max(0, minSplashDuration - elapsed);

      // For GIFs, also wait for the GIF to complete one loop
      const remainingGifDuration = isGif
        ? Math.max(0, ESTIMATED_GIF_DURATION - elapsed)
        : 0;

      const totalWaitTime = Math.max(remainingMinDuration, remainingGifDuration);

      if (totalWaitTime > 0) {
        // Wait for the remaining time before hiding
        setTimeout(() => {
          setIsHidden(true);
          RNApptile?.notifyJSReady();
        }, totalWaitTime);
      } else {
        // Can hide immediately
        setIsHidden(true);
        RNApptile?.notifyJSReady();
      }
    };

    showJSSplashScreen = () => {
      hideRequestedRef.current = false;
      setIsHidden(false);
      startTimeRef.current = Date.now();
    };

    setIsRendered(true);

    return () => {
      hideJSSplashScreen = () => {};
    };
  }, [minSplashDuration, isGif]);

  const imageSource = splashImageSource;

  return (
    <>
      {isRendered && children}
      {!isHidden && (
        <Wrapper>
          <View style={styles.container}>
            <Image
              style={styles.image}
              source={imageSource}
              resizeMode="cover"
            />
          </View>
        </Wrapper>
      )}
    </>
  );
};

const Wrapper: React.FC<{children?: React.ReactNode}> = ({children}) => {
  return Platform.OS === 'android' ? (
    <Modal statusBarTranslucent transparent>
      {children}
    </Modal>
  ) : (
    <View style={styles.root}>{children}</View>
  );
};

export default JSSplash;