import { contrastingTextColor } from '@/lib/colorUtils';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, type ColorScheme } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  accentColor?: string;
  colorScheme: ColorScheme;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function DenseButton({
  label,
  onPress,
  variant = 'secondary',
  accentColor,
  colorScheme,
  style,
  disabled,
}: Props) {
  const theme = Colors[colorScheme];
  const accent = accentColor ?? theme.primary;

  let bg: string = theme.surface;
  let border: string = theme.divider;
  let text: string = theme.text;

  if (variant === 'primary') {
    bg = accent;
    border = accent;
    text = contrastingTextColor(accent);
  } else if (variant === 'ghost') {
    bg = 'transparent';
    text = theme.textMuted;
  } else if (variant === 'danger') {
    bg = theme.surface;
    border = theme.error;
    text = theme.error;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
