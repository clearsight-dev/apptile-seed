import React from 'react';
import { ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

interface IAppInfoProps {
  logoSource?: ImageSourcePropType;
  appName: string;
  forkName?: string;
  branchName?: string;
  showLiveBadge?: boolean;
}

const AppInfo: React.FC<IAppInfoProps> = ({
  appName,
  forkName,
  branchName,
  showLiveBadge,
}) => {
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.appName}>{appName} {forkName && <Text style={styles.forkName}>{`(${forkName}${branchName ? `, ${branchName}` : ''})`}</Text>}</Text>
      {showLiveBadge && (
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>Live</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 20,
    marginTop: 20,
    height: 71,
    paddingLeft: 40,
  },
  forkName: {
    fontSize: 18,
    fontWeight: '400',
    color: '#999',
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