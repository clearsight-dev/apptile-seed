import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator, View } from 'react-native';

interface StyledButtonProps {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'outline';
  loading?: boolean;
  disabled?: boolean;
}

const StyledButton: React.FC<StyledButtonProps> = ({
  title,
  onPress,
  style,
  variant = 'default',
  loading = false,
  disabled = false
}) => {
  const isInactive = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        variant === 'outline' ? styles.buttonOutline : styles.button,
        isInactive && (variant === 'outline' ? styles.buttonOutlineInactive : styles.buttonInactive),
        style
      ]}
      onPress={isInactive ? undefined : onPress}
      activeOpacity={0.85}
      disabled={isInactive}
    >
      <View style={styles.contentRow}>
        <Text style={[
          variant === 'outline' ? styles.textOutline : styles.text,
          isInactive && styles.textDisabled
        ]}>{title}</Text>
        {loading && <ActivityIndicator size="small" color={variant === 'outline' ? '#1060E0' : '#fff'} style={styles.loader} />}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1060E0',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInactive: {
    backgroundColor: '#B3B3B3',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1060E0',
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutlineInactive: {
    borderColor: '#A3A3A3',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginLeft: 8,
  },
  text: {
    color: '#fff',
    fontFamily: 'Circular Std',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'center',
  },
  textOutline: {
    color: '#1060E0',
    fontFamily: 'Circular Std',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'center',
  },
  textDisabled: {
    color: '#E0E0E0',
  },
});

export default StyledButton; 