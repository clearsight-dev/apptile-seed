import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getFormattedDate } from '../utils/commonUtil';

interface BranchListCardProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  startDate?: string;
  endDate?: string;
}

const BranchListCard: React.FC<BranchListCardProps> = ({ label, selected, onPress, startDate, endDate }) => {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  let pill = null;
  if (start && start > now) {
    pill = <View style={[styles.pill, styles.upcoming]}><Text style={styles.upcomingPillText}>UPCOMING</Text></View>;
  } else if (end && end < now) {
    pill = <View style={[styles.pill, styles.completed]}><Text style={styles.upcomingPillText}>COMPLETED</Text></View>;
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        selected && styles.selected
      ]}
      onPress={onPress}
      activeOpacity={0.8}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
        {pill && <View style={styles.pillWrapper}>{pill}</View>}
      </View>
      {(startDate && endDate) && (
        <View style={styles.datesRow}>
          {(startDate && endDate) && 
          <>
               <Image 
               source={require('../assets/Clock.png')}
               style={{ width: 14, height: 14, marginRight: 6, marginTop: 3 }}
               resizeMode="contain"
             />
          <Text style={styles.dateText}>{`${getFormattedDate(startDate)} - ${getFormattedDate(endDate)}`}</Text>
          </>
          }
        </View>
      )}
    </TouchableOpacity>
  );
};

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
    height: 98,
    minHeight: 68,
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    justifyContent: 'space-between',
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
    marginTop: 15,
    marginLeft: 2,
    flexDirection: 'row'
  },
  dateText: {
    fontSize: 12,
    color: '#000',
    marginTop: 2,
  },
  pillWrapper: {
    marginLeft: 8,
    alignSelf: 'flex-end',
  },
  pill: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    minWidth: 0,
    marginRight: 12,
  },
  upcomingPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  completedPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#636E72',
  },
  upcoming: {
    backgroundColor: '#7DB8E8',
  },
  completed: {
    backgroundColor: '#D9D9D9',
  },
});

export default BranchListCard; 