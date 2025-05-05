import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface TooltipProps {
  visible: boolean;
  onClose: () => void;
  message: string;
  style?: object;
}

const Tooltip: React.FC<TooltipProps> = ({ visible, onClose, message, style }) => {
  if (!visible) return null;
  return (
    <>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.tooltip, style]}>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>Close</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.01)',
    zIndex: 99,
  },
  tooltip: {
    position: 'absolute',
    top: 35,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FF2D1A',
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
  },
  message: {
    color: '#FF2D1A',
    fontWeight: '500',
  },
  close: {
    color: '#007AFF',
    marginTop: 0,
  },
});

export default Tooltip; 