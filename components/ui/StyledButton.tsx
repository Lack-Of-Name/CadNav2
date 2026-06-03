import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isLightColor } from '@/lib/colorUtils';

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
  const colorScheme = useColorScheme() ?? 'light';
  const defaultTint = Colors[colorScheme].tint;
  const resolvedColor = color ?? defaultTint;
  const secondaryBg = Colors[colorScheme].surface;

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
