import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenParams } from '../screenParams';
import LanguageOption from './LanguageOption';
import StyledButton from './StyledButton';
import AppInfo from './AppInfo';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<ScreenParams, 'Branch'>;

const Branch: React.FC<Props> = ({ route, navigation }) => {
  const { appId, branches } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(branches && branches.length > 0 ? branches[0].id : null);

  const handleBranchPress = async (branchId: number) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      navigation.navigate('AppDetail', {
        appId,
        forkId: branch.forkId,
        branchName: branch.branchName
      });
    }
  };

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
        <AppInfo />

        <View style={styles.regionTitleRow}>
          <Image
            source={require('../assets/versionSelect.png')}
            style={styles.regionIcon}
            resizeMode="contain"
          />
          <Text style={styles.regionTitleText}>Select a saved version</Text>
        </View>
        <View style={styles.cardContainer}>
          <View style={styles.languageList}>
            {branches && branches.map(branch => (
              <LanguageOption
                key={branch.id}
                label={branch.title}
                selected={selectedBranchId === branch.id}
                onPress={() => setSelectedBranchId(branch.id)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.bottomButtonContainer}>
        <StyledButton
          title="Select"
          onPress={() => {
            if (selectedBranchId) {
              handleBranchPress(selectedBranchId);
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
    width: 19,
    height: 19,
    marginRight: 8
  },
  regionTitleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D2D2D',
    fontFamily: 'Circular Std',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  backButton: {
    fontSize: 24,
    color: '#222',
    marginRight: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    fontFamily: 'Circular Std',
  },
});

export default Branch; 