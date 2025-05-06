import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenParams } from '../screenParams';
import { IForkWithBranches } from '../types/type';
import LanguageOption from './LanguageOption';
import StyledButton from './StyledButton';
import AppInfo from './AppInfo';
import { fetchBranchesApi, fetchManifestApi } from '../utils/api';
import { defaultBranchName } from '../constants/constant';
// import {getConfigValue} from 'apptile-core';

type Props = NativeStackScreenProps<ScreenParams, 'Fork'>;

const Fork: React.FC<Props> = ({ navigation, route }) => {
  const { appId, forks } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedForkId, setSelectedForkId] = useState<number | null>(forks && forks.length > 0 ? forks[0].id : null);
  const [appName, setAppName] = useState('');

  const fetchBranches = async (forkId: number) => {
    try {
      setLoading(true);
      setError(null);
      const branchData: IForkWithBranches = await fetchBranchesApi(appId, forkId);
      if (branchData.branches.length > 1) {
        // Navigate to Branch screen if there are multiple branches
        navigation.navigate('Branch', {
          appId: appId,
          branches: branchData.branches,
          forkId: forkId,
          appName: appName
        });
      } else {
        // Navigate to AppDetail screen if there's only one branch
        navigation.navigate('AppDetail', {
          appId: appId,
          forkId: forkId,
          branchName: defaultBranchName
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch branches');
      console.error('Error fetching branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchManifest() {
      try {
        const manifest = await fetchManifestApi(appId);
        setAppName(manifest.name);
      } catch (err) {
        console.error('Error fetching manifest:', err);
      }
    }
    fetchManifest();
  }, [appId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={styles.onboardingContainer} showsVerticalScrollIndicator={false}>


        <AppInfo appName={appName} showLiveBadge={false} />

        <View style={styles.regionTitleRow}>
          <Image
            source={require('../assets/regionIcon.png')}
            style={styles.regionIcon}
            resizeMode="contain"
          />
          <Text style={styles.regionTitleText}>Select a Language & Region to view</Text>
        </View>


        <View style={styles.cardContainer}>
          <View style={styles.languageList}>
            {forks && forks.map(fork => (
              <LanguageOption
                key={fork.id}
                label={fork.title}
                selected={selectedForkId === fork.id}
                onPress={() => setSelectedForkId(fork.id)}
              />
            ))}
          </View>
        </View>



      </ScrollView>


      <View style={styles.bottomButtonContainer}>
        <StyledButton
          title="Select"
          onPress={() => {
            if (selectedForkId) {
              fetchBranches(selectedForkId);
            }
          }}
          style={styles.selectButton}
        />
      </View>


    </View>
  );
};

const styles = StyleSheet.create({
  onboardingContainer: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 32,
    paddingHorizontal: 0,
  },
  cardContainer: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
    paddingTop: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  languageList: {
    width: '100%',
    marginBottom: 8,
  },
  selectButton: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  bottomButtonContainer: {
    width: '100%',
    paddingHorizontal: 54,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 0,
    // Optionally add shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    // Optionally add elevation for Android
    elevation: 8,
    marginBottom: 30
  },
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
  },
  regionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 26
  },
  regionIcon: {
    width: 24,
    height: 24,
    marginRight: 8
  },
  regionTitleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D2D2D',
    fontFamily: 'Circular Std',
  },
});

export default Fork; 