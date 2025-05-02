import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenParams } from '../screenParams';
import { IAppFork, IForkWithBranches, IBranch } from '../types/type';
// import {getConfigValue} from 'apptile-core';

type Props = NativeStackScreenProps<ScreenParams, 'Fork'>;

const Fork: React.FC<Props> = ({ navigation, route }) => {
  const { appId, forks } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = async (forkId: number) => {
    try {
      // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
      const APPTILE_API_ENDPOINT = 'http://localhost:3000';
      setLoading(true);
      setError(null);
      const response = await fetch(`${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/fork/${forkId}/branches`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: IForkWithBranches = await response.json();
      
      if (data.branches.length > 1) {
        // Navigate to Branch screen if there are multiple branches
        navigation.navigate('Branch', {
          appId: appId,
          branches: data.branches
        });
      } else {
        // Navigate to AppDetail screen if there's only one branch
        const singleBranch = data.branches?.[0];
        navigation.navigate('AppDetail', {
          appId: appId,
          forkId: forkId,
          branchId: singleBranch?.id,
          branchName: singleBranch?.branchName
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch branches');
      console.error('Error fetching branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderForkItem = ({ item }: { item: IAppFork }) => (
    <TouchableOpacity 
      style={styles.item}
      onPress={() => fetchBranches(item.id)}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>Version: {item.frameworkVersion}</Text>
      <Text style={styles.subtitle}>Commit ID: {item.publishedCommitId}</Text>
    </TouchableOpacity>
  );

  const renderBranchItem = ({ item }: { item: IBranch }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>Branch: {item.branchName}</Text>
      <Text style={styles.subtitle}>Commit ID: {item.headCommitId}</Text>
      {item.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
    </TouchableOpacity>
  );

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
    <View style={styles.container}>
      <FlatList
        data={forks}
        renderItem={renderForkItem}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  item: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  defaultBadge: {
    marginTop: 5,
    color: '#fff',
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
});

export default Fork; 