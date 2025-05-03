import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const AppInfo = () => {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.logoBox}>
        <Image
          source={require('../assets/apptile-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.appName}>Mondo TNT</Text>
      <View style={styles.liveBadge}>
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 20,
    marginTop: 20
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
  },
  logo: {
    width: 32,
    height: 32,
  },
  appName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#111',
    fontFamily: 'Circular Std',
  },
  liveBadge: {
    backgroundColor: '#6DD13B',
    borderRadius: 28,
    justifyContent: 'center',
    height: 25,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  liveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Circular Std',
  }
});

export default AppInfo