import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

type Props = {
  count: number;
  hasCritical: boolean;
  top: number;
  right: number;
  onPress: () => void;
};

function WarningIcon({ size = 18, bg }: { size?: number; bg: string }) {
  // White triangle with bg-coloured "!" cutout
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Triangle */}
      <Path d="M12 2.8 L21.2 20 H2.8 Z" fill="white" />
      {/* Exclamation bar */}
      <Path d="M11 8.5 H13 V14 H11 Z" fill={bg} />
      {/* Dot */}
      <Path d="M11 16 H13 V18 H11 Z" fill={bg} />
    </Svg>
  );
}

export function CompassWarningChip({ count, hasCritical, top, right, onPress }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  if (count <= 0) return null;

  const bg = hasCritical ? palette.error : palette.warning;

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { top, right }]}>
      <Animated.View entering={ZoomIn.duration(220).springify().damping(16)} exiting={ZoomOut.duration(180)} style={{}}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Compass inaccurate: ${count} issue${count === 1 ? '' : 's'}`}
          hitSlop={10}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: bg,
              borderColor: palette.surface,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <WarningIcon size={18} bg={bg} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    zIndex: 60,
  },
  chip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
});
