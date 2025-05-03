import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LanguageOptionProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

const LanguageOption: React.FC<LanguageOptionProps> = ({ label, selected, onPress }) => (
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
    height: 68
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
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
  }
});

export default LanguageOption; 