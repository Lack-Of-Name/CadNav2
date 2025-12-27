import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'selection';

export async function triggerHaptic(intensity: HapticIntensity) {
  try {
    if (Platform.OS === 'android' && typeof Haptics.performAndroidHapticsAsync === 'function') {
      // Map generic intensities to AndroidHaptics enums
      const Android = (Haptics as any).AndroidHaptics ?? (Haptics as any).AndroidHaptics;
      const map: Record<HapticIntensity, string> = {
        light: (Android && Android.Segment_Frequent_Tick) || 'segment-frequent-tick',
        medium: (Android && Android.Segment_Tick) || 'segment-tick',
        heavy: (Android && Android.Confirm) || 'confirm',
        selection: (Android && Android.Segment_Tick) || 'segment-tick',
      };
      const androidType = map[intensity] as any;
      try {
        await Haptics.performAndroidHapticsAsync(androidType);
      } catch {
        // fallback to impact if available
        const style =
          intensity === 'light'
            ? Haptics.ImpactFeedbackStyle.Light
            : intensity === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Heavy;
        if (typeof Haptics.impactAsync === 'function') {
          await Haptics.impactAsync(style);
        }
      }
      return;
    }

    if (intensity === 'selection' && typeof Haptics.selectionAsync === 'function') {
      await Haptics.selectionAsync();
      return;
    }

    const style =
      intensity === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : intensity === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
    if (typeof Haptics.impactAsync === 'function') {
      await Haptics.impactAsync(style);
    }
  } catch {
    // ignore haptic failures
  }
}

export function HapticPressable(props: BottomTabBarButtonProps & { intensity?: HapticIntensity }) {
  const { intensity = 'light', ...rest } = props as any;
  return (
    <PlatformPressable
      {...(rest as BottomTabBarButtonProps)}
      onPressIn={(ev) => {
        void triggerHaptic(intensity);
        rest.onPressIn?.(ev as any);
      }}
    />
  );
}
