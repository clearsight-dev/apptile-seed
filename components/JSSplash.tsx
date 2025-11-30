import React, {useEffect, useState} from 'react';
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

const JSSplash: React.FC<{children?: React.ReactNode; splashImageSource?: any}> = ({
  children,
  splashImageSource,
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isHidden, setIsHidden] = useState(isSplashHiddenAtStart);

  useEffect(() => {
    hideJSSplashScreen = () => {
      setIsHidden(true);
      RNApptile?.notifyJSReady();
    };
    showJSSplashScreen = () => setIsHidden(false);
    setIsRendered(true);

    return () => {
      hideJSSplashScreen = () => {};
    };
  }, []);

  const imageSource = splashImageSource;

  return (
    <>
      {isRendered && children}
      {!isHidden && (
        <Wrapper>
          <View style={styles.container}>
            <Image style={styles.image} source={imageSource} resizeMode="cover" />
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
