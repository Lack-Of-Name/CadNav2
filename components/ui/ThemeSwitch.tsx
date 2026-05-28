import { Colors } from '@/constants/theme';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Platform, Switch, SwitchProps } from 'react-native';

export type ThemeSwitchProps = Omit<SwitchProps, 'trackColor' | 'thumbColor'>;

export function ThemeSwitch(props: ThemeSwitchProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { activeRouteColor } = useCheckpoints();
  
  const theme = Colors[colorScheme];
  const tint = activeRouteColor ?? theme.tint;

  // iOS switches look best with a standard white thumb and tinted track
  // Android/Web switches usually color the thumb for 'on' and make the track a lighter/transparent hue
  const isIOS = Platform.OS === 'ios';
  
  const thumbColor = isIOS 
    ? theme.surface 
    : (props.value ? tint : theme.surface);

  const trackColor = isIOS 
    ? { false: theme.divider, true: tint } 
    : { false: theme.divider, true: `${tint}80` }; // 50% opacity for track

  return (
    <Switch
      {...props}
      trackColor={trackColor}
      thumbColor={thumbColor}
      {...(Platform.OS === 'web' && props.value ? { activeThumbColor: tint, activeTrackColor: `${tint}80` } : {})}
    />
  );
}
