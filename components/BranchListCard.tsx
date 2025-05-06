import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getFormattedDate } from '../utils/commonUtil';

interface BranchListCardProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  startDate?: string;
  endDate?: string;
}

const BranchListCard: React.FC<BranchListCardProps> = ({ label, selected, onPress, startDate, endDate }) => (
  <TouchableOpacity
    style={[
      styles.container,
      selected && styles.selected
    ]}
    onPress={onPress}
    activeOpacity={0.8}>
    <View style={styles.labelRow}>
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </View>
    {(startDate && endDate) && (
      <View style={styles.datesRow}>
        {(startDate && endDate) && <Text style={styles.dateText}>{`${getFormattedDate(startDate)} - ${getFormattedDate(endDate)}`}</Text>}
      </View>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    backgroundColor: '#F5F5F5',
    paddingLeft: 28,
    paddingTop: 16,
    paddingBottom: 16,
    height: 68,
    minHeight: 68,
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  selected: {
    borderColor: '#1060E0',
  },
  label: {
    fontFamily: 'Circular Std',
    fontWeight: '400',
    fontSize: 16,
    color: '#2D2D2D',
    textAlign: 'left',
    flex: 1,
  },
  selectedLabel: {
    color: '#1060E0',
    fontWeight: '500',
  },
  datesRow: {
    marginTop: 4,
    marginLeft: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});

export default BranchListCard; 