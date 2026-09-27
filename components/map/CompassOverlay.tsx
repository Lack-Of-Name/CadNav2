import { triggerHaptic } from '@/components/haptic-tab';
import { Colors, type ColorScheme } from '@/constants/theme';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Pressable, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { degreesToMils } from './converter';

type Props = {
  open: boolean;
  onToggle: () => void;
  colorScheme: ColorScheme;
  headingDeg?: number | null;
  angleUnit?: 'mils' | 'degrees' | string;
  targetBearingDeg?: number | null;
  targetLabel?: string | null;
  bearingText?: string | null;
  distanceText?: string | null;
  headingReferenceLabel?: string | null;
  targetColor?: string | null;
  onFloat?: () => void;
  style?: ViewStyle;  panelBg?: string;
  borderColor?: string;
  background?: string;
  textColor?: string;
  textMuted?: string;
  textSubtle?: string;
  primary?: string;
  tick?: string;
  tickStrong?: string;
};

const normalize360 = (value: number) => {
  'worklet';
  return ((value % 360) + 360) % 360;
};

/**
 * 24 ticks total (every 15°):
 * - Major ticks every 45° (N, NE, E, etc.)
 * - Minor ticks at 15° and 30° between majors
 */
const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

const isCardinal = (deg: number) => deg % 90 === 0;

function labelForAngle(deg: number, unit?: string) {
  if (deg === 90) return 'E';
  if (deg === 180) return 'S';
  if (deg === 270) return 'W';

  if (unit === 'mils') {
    return String(Math.round(degreesToMils(deg, { normalize: true })));
  }

  return String(deg);
}

// New function for cardinal heading labels below the tick lines
function headingLabelForAngle(deg: number, unit?: string) {
  if (!isCardinal(deg)) return '';
  if (unit === 'mils') return String(Math.round(degreesToMils(deg, { normalize: true })));
  return String(deg);
}

export function CompassOverlay({
  open,
  onToggle,
  colorScheme,
  headingDeg,
  angleUnit,
  targetBearingDeg,
  targetLabel,
  bearingText,
  distanceText,
  headingReferenceLabel,
  targetColor,
  onFloat,
  style,
  panelBg,
  borderColor,
  background,
  textColor,
  textMuted,
  textSubtle,
  primary,
  tick,
  tickStrong,
}: Props) {
  const theme = Colors[colorScheme];
  const resolvedPanelBg = panelBg ?? theme.surface;
  const resolvedBorder = borderColor ?? theme.divider;
  const resolvedBackground = background ?? theme.background;
  const resolvedText = textColor ?? theme.text;
  const resolvedMuted = textMuted ?? theme.textMuted;
  const resolvedSubtle = textSubtle ?? theme.textSubtle;
  const resolvedPrimary = primary ?? theme.primary;
  const resolvedTick = tick ?? theme.textSubtle;
  const resolvedTickStrong = tickStrong ?? theme.text;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const heading = typeof headingDeg === 'number' ? normalize360(headingDeg) : null;

  const cardWidth = useMemo(() => {
    const max = Math.max(260, Math.min(360, windowWidth - 24));
    return max;
  }, [windowWidth]);

  const dialSize = useMemo(() => {
    // Rough vertical budgeting: header + padding + readout ~= 200px.
    const maxByWidth = cardWidth - 80;
    const maxByHeight = windowHeight - 220;
    return Math.max(180, Math.min(280, maxByWidth, maxByHeight));
  }, [cardWidth, windowHeight]);

  const scale = useMemo(() => dialSize / 280, [dialSize]);

  const animatedHeading = useSharedValue(heading ?? 0);

  useEffect(() => {
    if (heading != null) {
      const current = animatedHeading.value;
      const target = heading;
      // shortest path
      let diff = ((target - (current % 360) + 540) % 360) - 180;
      animatedHeading.value = withTiming(current + diff, {
        duration: 100,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [heading, animatedHeading]);

  const ringStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${-animatedHeading.value}deg` }],
    };
  });

  const pointerStyle = useAnimatedStyle(() => {
    if (heading == null || typeof targetBearingDeg !== 'number') return { opacity: 0 };
    const target = normalize360(targetBearingDeg);
    const currHeading = ((animatedHeading.value % 360) + 360) % 360;
    const relative = target - currHeading;
    return {
      opacity: 1,
      transform: [{ rotate: `${relative}deg` }],
    };
  });

  const targetRingRotation = useMemo(() => {
    if (typeof targetBearingDeg !== 'number') return null;
    return `${normalize360(targetBearingDeg)}deg`;
  }, [targetBearingDeg]);

  // Haptic feedback: light tap when heading passes over any tick line
  const prevHeadingRef = useRef<number | null>(null);
  useEffect(() => {
    if (heading == null) {
      prevHeadingRef.current = null;
      return;
    }
    // Only provide haptics when the compass panel is open
    if (!open) {
      prevHeadingRef.current = heading;
      return;
    }

    const prev = prevHeadingRef.current;
    if (prev == null) {
      prevHeadingRef.current = heading;
      return;
    }

    const curr = heading;
    // Determine shortest path direction from prev to curr
    const forward = (curr - prev + 360) % 360;
    const pathIsForward = forward <= 180;
    const start = pathIsForward ? prev : curr;
    const end = pathIsForward ? curr : prev;
    const span = (end - start + 360) % 360;

    // Determine whether any major (45°) or minor (15°) ticks were crossed
    let crossedMajor = false;
    let crossedMinor = false;
    for (const tick of TICKS) {
      const rel = (tick - start + 360) % 360;
      if (rel > 0 && rel <= span) {
        if (tick % 45 === 0) crossedMajor = true;
        else crossedMinor = true;
      }
      if (crossedMajor && crossedMinor) break;
    }

    if (crossedMajor) {
      void triggerHaptic('medium');
    } else if (crossedMinor) {
      void triggerHaptic('light');
    }

    prevHeadingRef.current = curr;
  }, [heading, open]);

  if (!open) return null;

  return (
    <View style={styles.overlayRoot}>
      <Pressable
        style={styles.backdrop}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="Close compass"
      />
      <View style={[styles.wrap, style]} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: resolvedPanelBg, borderColor: resolvedBorder, width: cardWidth, maxWidth: '100%' }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: resolvedText }]}>Compass</Text>
              <Text style={[styles.subtitle, { color: resolvedMuted }]} numberOfLines={1}>
                {targetLabel ? `Target: ${targetLabel}` : 'No target selected'}
              </Text>
            </View>

            <Pressable
              style={[styles.close, { borderColor: resolvedBorder, backgroundColor: resolvedBackground }]}
              onPress={onToggle}
              accessibilityRole="button"
              accessibilityLabel="Close compass"
            >
              <Text style={[styles.closeText, { color: resolvedText }]}>×</Text>
            </Pressable>
          </View>

          <View style={[styles.dial, { backgroundColor: resolvedBackground, borderColor: resolvedBorder, width: dialSize, height: dialSize }]}>
            <Animated.View style={[styles.ring, ringStyle]}>
              {TICKS.map((deg) => {
                const isMajor = deg % 45 === 0;
                const cardinal = isCardinal(deg);
                const label = isMajor ? labelForAngle(deg, angleUnit) : '';
                const headingLabel = headingLabelForAngle(deg, angleUnit);

                return (
                  <View
                    key={deg}
                    style={[styles.tickWrap, { transform: [{ rotate: `${deg}deg` }] }]}
                  >
                    <View
                      style={[
                        styles.tick,
                        cardinal
                          ? [styles.tickCardinal, { width: 3 * scale, height: 26 * scale, marginTop: 12 * scale }]
                          : isMajor
                            ? [styles.tickMajor, { width: 2 * scale, height: 20 * scale, marginTop: 12 * scale }]
                            : [styles.tickMinor, { width: 1 * scale, height: 12 * scale, marginTop: 18 * scale }],
                        { backgroundColor: cardinal || isMajor ? resolvedTickStrong : resolvedTick },
                      ]}
                    />

                    {/* Ring label (only for major ticks) */}
                    {isMajor ? (
                      <View style={styles.ringLabelWrap}>
                        <Text
                          style={[
                            styles.ringLabel,
                            { color: resolvedTickStrong },
                            cardinal ? styles.ringLabelCardinal : styles.ringLabelDegree,
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    ) : null}

                    {/* Heading number label below the tick */}
                    {cardinal && (
                      <View style={[styles.headingLabelWrap, { top: 38 * scale }]}>
                        <Text style={[styles.headingLabel, { color: resolvedTickStrong, fontSize: Math.max(7, 8 * scale) }]}>
                          {headingLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Target bearing marker on the ring */}
              {targetRingRotation ? (
                <View style={[styles.targetMarkWrap, { transform: [{ rotate: targetRingRotation }] }]}>
                  <View style={[styles.targetMarkStick, {
                    borderBottomColor: targetColor || resolvedPrimary,
                    marginTop: 0,
                    borderLeftWidth: 5 * scale,
                    borderRightWidth: 5 * scale,
                    borderBottomWidth: 120 * scale,
                    transform: [{ translateY: -60 * scale }],
                  }]} />
                  <View style={{ position: 'absolute', width: 12 * scale, height: 12 * scale, borderRadius: 6 * scale, backgroundColor: targetColor || resolvedPrimary, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 4 * scale, height: 4 * scale, borderRadius: 2 * scale, backgroundColor: resolvedBackground }} />
                  </View>
                </View>
              ) : null}

              {/* N marker */}
              <View style={[styles.nLabelWrap, { top: 6 * scale }]}>
                <View style={[styles.nLabelPill, { borderColor: resolvedBorder, backgroundColor: resolvedBackground }]}>
                  <Text style={[styles.nLabelText, { color: resolvedText, fontSize: Math.max(9, 11 * scale) }]}>N</Text>
                </View>
              </View>
            </Animated.View>

            {/* Heading needle */}
            <View
              style={[
                styles.needle,
                { backgroundColor: resolvedPrimary, height: 96 * scale, top: 20 * scale, width: Math.max(1.5, 2 * scale) },
              ]}
            />

            {/* Target pointer */}
            {typeof targetBearingDeg === 'number' ? (
              <Animated.View style={[styles.targetPointerWrap, pointerStyle]}>
                <View
                  style={[
                    styles.targetPointer,
                    {
                      marginTop: 0,
                      borderLeftWidth: 5 * scale,
                      borderRightWidth: 5 * scale,
                      borderBottomWidth: 120 * scale,
                      borderBottomColor: targetColor || resolvedPrimary,
                      transform: [{ translateY: -60 * scale }],
                    },
                  ]}
                />
                <View style={{ position: 'absolute', width: 12 * scale, height: 12 * scale, borderRadius: 6 * scale, backgroundColor: targetColor || resolvedPrimary, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 4 * scale, height: 4 * scale, borderRadius: 2 * scale, backgroundColor: resolvedBackground }} />
                </View>
              </Animated.View>
            ) : null}
          </View>

          {/* READOUT */}
          <View style={styles.readout}>
            <View style={styles.readoutRow}>
              <View style={styles.readoutCell}>
                <Text style={[styles.readoutLabel, { color: resolvedSubtle }]}>Heading</Text>
                <Text style={[styles.readoutValue, { color: resolvedText }]}>
                  {heading == null
                    ? '—'
                    : angleUnit === 'mils'
                    ? `${Math.round(degreesToMils(heading, { normalize: true }))} mils`
                    : `${Math.round(heading)}°`}
                </Text>
                {headingReferenceLabel ? (
                  <Text style={[styles.readoutSub, { color: resolvedMuted }]} numberOfLines={1}>
                    {headingReferenceLabel}
                  </Text>
                ) : null}
              </View>

              <View style={styles.readoutCell}>
                <Text style={[styles.readoutLabel, { color: resolvedSubtle }]}>Bearing</Text>
                <Text style={[styles.readoutValue, { color: resolvedText }]} numberOfLines={1}>
                  {bearingText ?? '—'}
                </Text>
              </View>

              <View style={styles.readoutCell}>
                <Text style={[styles.readoutLabel, { color: resolvedSubtle }]}>Distance</Text>
                <Text style={[styles.readoutValue, { color: resolvedText }]} numberOfLines={1}>
                  {distanceText ?? '—'}
                </Text>
              </View>
            </View>
          </View>

          {onFloat ? (
            <View style={styles.floatRow}>
              <Pressable
                style={[styles.floatBtn, { borderColor: resolvedBorder, backgroundColor: resolvedBackground }]}
                onPress={onFloat}
                accessibilityRole="button"
                accessibilityLabel="Open mini compass"
              >
                <Text style={[styles.floatText, { color: resolvedText }]}>Open mini compass</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 65,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  wrap: {
    position: 'absolute',
    maxWidth: '100%',
    zIndex: 2,
    alignItems: 'center',
  },
  card: {
    width: 360,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: -1,
  },
  dial: {
    marginTop: 12,
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
  },
  tickWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  tick: {
    marginTop: 12,
    borderRadius: 999,
  },
  tickCardinal: {
    width: 3,
    height: 26,
  },
  tickMajor: {
    width: 2,
    height: 20,
  },
  tickMinor: {
    width: 1,
    height: 12,
    marginTop: 18,
  },
  ringLabelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ringLabel: {
    fontWeight: '800',
  },
  ringLabelCardinal: {
    fontSize: 12,
    marginTop: 6,
    transform: [{ translateY: -5 }],
  },
  ringLabelDegree: {
    fontSize: 9,
    marginTop: 2,
  },

  // New heading label style
  headingLabelWrap: {
    position: 'absolute',
    top: 38, // below tick
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headingLabel: {
    fontSize: 8,
    fontWeight: '700',
  },

  nLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    alignItems: 'center',
  },
  nLabelPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nLabelText: {
    fontSize: 11,
    fontWeight: '800',
  },
  needle: {
    position: 'absolute',
    width: 2,
    height: 96,
    top: 20,
    borderRadius: 999,
  },
  targetPointerWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetPointer: {
    marginTop: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 120,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  targetMarkWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetMarkStick: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  readout: {
    marginTop: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  readoutRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  readoutCell: {
    flex: 1,
    alignItems: 'center',
  },
  readoutLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  readoutValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '800',
  },
  readoutSub: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },
  floatRow: {
    marginTop: 12,
  },
  floatBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
