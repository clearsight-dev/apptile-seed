import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenParams } from '../screenParams';
import { IBranch } from '../types/type';

type Props = NativeStackScreenProps<ScreenParams, 'Branch'>;

const Branch: React.FC<Props> = ({ route, navigation }) => {
  const { appId, branches } = route.params;

  const handleBranchPress = (branch: IBranch) => {
    navigation.navigate('AppDetail', {
      appId,
      forkId: branch.forkId,
      branchId: branch.id,
      branchName: branch.branchName
    });
  };

  const renderItem = ({ item }: { item: IBranch }) => (
    <TouchableOpacity 
      style={styles.item}
      onPress={() => handleBranchPress(item)}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>Branch: {item.branchName}</Text>
      <Text style={styles.subtitle}>Commit ID: {item.headCommitId}</Text>
      {item.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
      <Text style={styles.subtitle}>Created: {new Date(item.createdAt).toLocaleString()}</Text>
      {item.deletedAt && (
        <Text style={styles.deletedText}>Deleted: {new Date(item.deletedAt).toLocaleString()}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>App ID: {appId}</Text>
        <Text style={styles.branchCount}>{branches.length} branches</Text>
      </View>
      <FlatList
        data={branches}
        renderItem={renderItem}
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  headerTitle: {
    fontSize: 16,
    color: '#666',
  },
  branchCount: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
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
  deletedText: {
    marginTop: 5,
    color: '#ff3b30',
    fontSize: 14,
  },
});

export default Branch; 