import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, type ColorScheme } from '@/constants/theme';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
  const iconColor = active ? accent : theme.text;

  const renderIcon = () => {
    // VSCode codicon diamond — used for temp point button, tint follows active/accent like other buttons
    if (icon === 'temp-point-diamond') {
      return (
        <Svg width={22} height={22} viewBox="0 0 16 16" fill={iconColor}>
          <Path
            d="M3.02 7.98L8 3l4.98 4.98L8 12.96 3.02 7.98zM8 10.77l2.79-2.79L8 5.19 5.21 7.98 8 10.77z"
            fill={iconColor}
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </Svg>
      );
    }
    return <IconSymbol name={icon as any} size={22} color={iconColor} />;
  };

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
      {renderIcon()}
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
