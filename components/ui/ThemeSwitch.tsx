import React from 'react';
import { Platform, Switch, SwitchProps } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCheckpoints } from '@/hooks/checkpoints';

export type ThemeSwitchProps = Omit<SwitchProps, 'trackColor' | 'thumbColor'>;

export function ThemeSwitch(props: ThemeSwitchProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { activeRouteColor } = useCheckpoints();
  
  // Use the active route color, fallback to theme tint (or a default bright color so dark mode doesn't blend into white-on-white)
  const tint = activeRouteColor ?? (colorScheme === 'dark' ? '#0A84FF' : Colors.light.tint);

  // iOS switches look best with a standard white thumb and tinted track
  // Android/Web switches usually color the thumb for 'on' and make the track a lighter/transparent hue
  const isIOS = Platform.OS === 'ios';
  
  const thumbColor = isIOS 
    ? '#ffffff' 
    : (props.value ? tint : '#f4f3f4');

  const trackColor = isIOS 
    ? { false: '#e9e9ea', true: tint } 
    : { false: colorScheme === 'dark' ? '#39393d' : '#e9e9ea', true: `${tint}80` }; // 50% opacity for track

  return (
    <Switch
      {...props}
      trackColor={trackColor}
      thumbColor={thumbColor}
      {...(Platform.OS === 'web' && props.value ? { activeThumbColor: tint, activeTrackColor: `${tint}80` } : {})}
    />
  );
}
