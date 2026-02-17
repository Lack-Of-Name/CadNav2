import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

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
  const secondaryBg = useThemeColor({ light: '#fff', dark: '#2c2c2e' }, 'background');
  const secondaryBorder = useThemeColor({ light: '#007AFF', dark: '#0A84FF' }, 'tint');
  const secondaryTextColor = useThemeColor({ light: '#007AFF', dark: '#0A84FF' }, 'tint');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={activeOpacity}
      disabled={disabled}
      style={[
        styles.button,
        primary
          ? styles.primaryButton
          : { backgroundColor: secondaryBg, borderWidth: 1, borderColor: secondaryBorder },
        style,
        disabled && styles.disabled,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.buttonText, primary ? styles.primaryText : { color: secondaryTextColor }]}>{children}</Text>
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
  disabled: {
    opacity: 0.6,
  },
});
