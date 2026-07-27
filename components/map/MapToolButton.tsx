import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, type ColorScheme } from '@/constants/theme';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

const SIZE = 48;

type Props = {
  icon: string;
  label: string;
  onPress: () => void;
  colorScheme: ColorScheme;
  active?: boolean;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function MapToolButton({ icon, label, onPress, colorScheme, active, accentColor, style }: Props) {
  const theme = Colors[colorScheme];
  const accent = accentColor ?? theme.primary;
  const border = active ? accent : theme.divider;

  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: theme.surface,
          borderColor: border,
          opacity: pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      <IconSymbol name={icon as any} size={22} color={active ? accent : theme.text} />
    </Pressable>
  );
}

export const MAP_TOOL_BUTTON_SIZE = SIZE;

const styles = StyleSheet.create({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
