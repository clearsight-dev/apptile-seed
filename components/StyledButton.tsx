import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

interface StyledButtonProps {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
}

const StyledButton: React.FC<StyledButtonProps> = ({ title, onPress, style }) => (
  <TouchableOpacity style={[styles.button, style]} onPress={onPress} activeOpacity={0.85}>
    <Text style={styles.text}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1060E0',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontFamily: 'Circular Std',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default StyledButton; 