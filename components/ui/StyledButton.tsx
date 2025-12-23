import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

type Props = {
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  activeOpacity?: number;
};

export default function StyledButton({ onPress, variant = 'primary', disabled = false, style, children, activeOpacity = 0.8 }: Props) {
  const primary = variant === 'primary';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={activeOpacity}
      disabled={disabled}
      style={[styles.button, primary ? styles.primaryButton : styles.secondaryButton, style, disabled && styles.disabled]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.buttonText, primary ? styles.primaryText : styles.secondaryText]}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryText: {
    color: '#007AFF',
  },
  disabled: {
    opacity: 0.6,
  },
});
