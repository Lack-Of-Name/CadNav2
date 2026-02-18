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
  color?: string;
};

export default function StyledButton({ onPress, variant = 'primary', disabled = false, style, children, activeOpacity = 0.8, color }: Props) {
  const primary = variant === 'primary';
  const defaultTint = useThemeColor({ light: '#007AFF', dark: '#0A84FF' }, 'tint');
  const resolvedColor = color ?? defaultTint;
  const secondaryBg = useThemeColor({ light: '#fff', dark: '#2c2c2e' }, 'background');

  // Determine if the resolved color is "light" (needs dark text) or "dark" (needs white text)
  const primaryTextColor = isLightColor(resolvedColor) ? '#000' : '#fff';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={activeOpacity}
      disabled={disabled}
      style={[
        styles.button,
        primary
          ? { backgroundColor: resolvedColor }
          : { backgroundColor: secondaryBg, borderWidth: 1.5, borderColor: resolvedColor },
        style,
        disabled && styles.disabled,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[
          styles.buttonText,
          primary
            ? { color: primaryTextColor }
            : { color: resolvedColor },
        ]}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

/** Returns true if a hex color is perceptually light (needs dark text on top). */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // W3C relative luminance threshold
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
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
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
});
