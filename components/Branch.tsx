import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenParams } from '../screenParams';
import { IBranch, IOtaSnapshot, IOtaSnapshotResponse } from '../types/type';
import { fetchCommitApi, fetchManifestApi, fetchOtaSnapshotsApi } from '../utils/api';
import AppInfo from './AppInfo';
import BranchListCard from './BranchListCard';
import StyledButton from './StyledButton';

type Props = NativeStackScreenProps<ScreenParams, 'Branch'>;

const Branch: React.FC<Props> = ({ route, navigation }) => {
  const { appId, branches, forkId, appName = '', forkName } = route.params;
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(branches && branches.length > 0 ? branches[0].id : null);
  const [liveBranchId, setLiveBranchId] = useState<number | null>(null);
  const [liveBranch, setLiveBranch] = useState<IBranch | null>(null);
  const [snapshotsWithLatestScheduledOta, setSnapshotsWithLatestScheduledOta] = useState<IOtaSnapshot[]>([]);

  async function fetchManifest() {
    const data = await fetchManifestApi(appId);
    const getPublishedCommitId = data?.forks.find(f => f.id === forkId)?.publishedCommitId;

    const commitData = await fetchCommitApi(getPublishedCommitId as number);
    setLiveBranchId(commitData?.branchId);
    const getLiveBranch = branches.find(b => b.id === commitData?.branchId) as IBranch;
    setLiveBranch(getLiveBranch);
  }

  async function fetchOtaSnapshots() {
    try {
      const otaSnapshots: IOtaSnapshotResponse = await fetchOtaSnapshotsApi(forkId);
      // Filter the array to keep only the latest snapshot for each branchId
      const latestByBranch = new Map<number, IOtaSnapshot>();
      otaSnapshots.forEach(snapshot => {
        const existing = latestByBranch.get(snapshot.branchId);
        if (!existing || new Date(snapshot.createdAt) > new Date(existing.createdAt)) {
          latestByBranch.set(snapshot.branchId, snapshot);
        }
      });
      const filteredSnapshots = otaSnapshots.filter(snapshot => {
        const latest = latestByBranch.get(snapshot.branchId);
        return latest && latest.id === snapshot.id;
      });

      // For each snapshot, keep only the latest scheduledOta (by createdAt)
      const processedSnapshots = filteredSnapshots.map(snapshot => {
        if (!snapshot.scheduledOtas || snapshot.scheduledOtas.length === 0) return snapshot;
        const latestScheduledOta = snapshot.scheduledOtas.reduce((latest, current) => {
          return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest;
        }, snapshot.scheduledOtas[0]);
        return {
          ...snapshot,
          scheduledOtas: [latestScheduledOta]
        };
      });

      setSnapshotsWithLatestScheduledOta(processedSnapshots);
      console.log('Filtered OTA Snapshots with only latest scheduledOta:', processedSnapshots);
    } catch (err) {
      console.error('Error fetching OTA snapshots:', err);
    }
  }
  useEffect(() => {
    fetchManifest();
    fetchOtaSnapshots();
  }, [appId]);

  const handleBranchPress = async (branchId: number) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      navigation.navigate('AppDetail', {
        appId,
        forkId: branch.forkId,
        forkName: forkName,
        branchName: branch.branchName
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={styles.onboardingContainer} showsVerticalScrollIndicator={false}>
        <AppInfo appName={appName} forkName={forkName} showLiveBadge={false} />

        <View style={styles.regionTitleRow}>
          <Image
            source={require('../assets/versionSelect.png')}
            style={styles.regionIcon}
            resizeMode="contain"
          />
          <Text style={styles.regionTitleText}>Select a Version to Preview</Text>
        </View>
        <View style={styles.cardContainer}>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Live Version</Text>
            <View style={styles.greenDot} />
          </View>
          <View style={styles.languageList}>
            {liveBranch && (
              <BranchListCard
                key={liveBranch.id}
                label={liveBranch.title || ''}
                selected={selectedBranchId === liveBranch.id}
                onPress={() => setSelectedBranchId(liveBranch.id)}
                startDate={(() => {
                  const snapshot = snapshotsWithLatestScheduledOta.find(s => s.branchId === liveBranch.id);
                  return snapshot ? snapshot.startDate : undefined;
                })()}
                endDate={(() => {
                  const snapshot = snapshotsWithLatestScheduledOta.find(s => s.branchId === liveBranch.id);
                  return snapshot ? snapshot.endDate : undefined;
                })()}
              />
            )}
          </View>
        </View>

        <View style={styles.cardContainer}>

          <Text style={styles.sectionTitle}>Other Version</Text>
          <View style={styles.languageList}>
            {branches && branches.filter(branch => branch.id !== liveBranchId).length === 0 ? (
              <View style={styles.noVersionsBox}>
                <Text style={styles.noVersionsText}>No Saved Versions Yet</Text>
              </View>
            ) : (
              branches && branches
                .filter(branch => branch.id !== liveBranchId)
                .map(branch => {
                  const snapshot = snapshotsWithLatestScheduledOta.find(s => s.branchId === branch.id);
                  return (
                    <BranchListCard
                      key={branch.id}
                      label={branch.title}
                      selected={selectedBranchId === branch.id}
                      onPress={() => setSelectedBranchId(branch.id)}
                      startDate={snapshot ? snapshot.startDate : undefined}
                      endDate={snapshot ? snapshot.endDate : undefined}
                    />
                  );
                })
            )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.bottomButtonContainer}>
        <StyledButton
          title="Proceed"
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
    // backgroundColor: 'red',
    width: '100%',
    paddingHorizontal: 40,
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
  sectionTitle: {
    color: '#2D2D2D',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 10
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6DD13B',
    marginLeft: 8,
    marginBottom: 8
  },
  noVersionsBox: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  noVersionsText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '400',
  },
});

export default Branch; 