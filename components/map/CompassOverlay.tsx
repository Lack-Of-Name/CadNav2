import { triggerHaptic } from '@/components/haptic-tab';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { degreesToMils } from './converter';

type Props = {
  open: boolean;
  onToggle: () => void;
  headingDeg?: number | null;
  angleUnit?: 'mils' | 'degrees' | string;
  targetBearingDeg?: number | null;
  targetLabel?: string | null;
  bearingText?: string | null;
  distanceText?: string | null;
  headingReferenceLabel?: string | null;
  style?: ViewStyle;
  panelBg: string;
  borderColor: string;
  background: string;
  textColor: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  tick: string;
  tickStrong: string;
};

const normalize360 = (value: number) => ((value % 360) + 360) % 360;

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
  headingDeg,
  angleUnit,
  targetBearingDeg,
  targetLabel,
  bearingText,
  distanceText,
  headingReferenceLabel,
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

  const ringRotation = useMemo(() => {
    if (heading == null) return '0deg';
    return `${-heading}deg`;
  }, [heading]);

  const pointerRotation = useMemo(() => {
    if (heading == null || typeof targetBearingDeg !== 'number') return null;
    const target = normalize360(targetBearingDeg);
    const relative = normalize360(target - heading);
    return `${relative}deg`;
  }, [heading, targetBearingDeg]);

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
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: panelBg, borderColor, width: cardWidth, maxWidth: '100%' }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: textColor }]}>Compass</Text>
            <Text style={[styles.subtitle, { color: textMuted }]} numberOfLines={1}>
              {targetLabel ? `Target: ${targetLabel}` : 'No target selected'}
            </Text>
          </View>

          <Pressable
            style={[styles.close, { borderColor, backgroundColor: background }]}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel="Close compass"
          >
            <Text style={[styles.closeText, { color: textColor }]}>×</Text>
          </Pressable>
        </View>

        <View style={[styles.dial, { backgroundColor: background, borderColor, width: dialSize, height: dialSize }]}>
          <View style={[styles.ring, { transform: [{ rotate: ringRotation }] }]}>
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
                      { backgroundColor: cardinal || isMajor ? tickStrong : tick },
                    ]}
                  />

                  {/* Ring label (only for major ticks) */}
                  {isMajor ? (
                    <View style={styles.ringLabelWrap}>
                      <Text
                        style={[
                          styles.ringLabel,
                          { color: tickStrong },
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
                      <Text style={[styles.headingLabel, { color: tickStrong, fontSize: Math.max(7, 8 * scale) }]}>
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
                <View style={[styles.targetMarkDot, { backgroundColor: primary }]} />
              </View>
            ) : null}

            {/* N marker */}
            <View style={[styles.nLabelWrap, { top: 6 * scale }]}>
              <View style={[styles.nLabelPill, { borderColor, backgroundColor: background }]}>
                <Text style={[styles.nLabelText, { color: textColor, fontSize: Math.max(9, 11 * scale) }]}>N</Text>
              </View>
            </View>
          </View>

          {/* Heading needle */}
          <View
            style={[
              styles.needle,
              { backgroundColor: primary, height: 96 * scale, top: 20 * scale, width: Math.max(1.5, 2 * scale) },
            ]}
          />

          {/* Target pointer */}
          {pointerRotation ? (
            <View style={[styles.targetPointerWrap, { transform: [{ rotate: pointerRotation }] }]}>
              <View
                style={[
                  styles.targetPointer,
                  {
                    marginTop: 18 * scale,
                    borderLeftWidth: 9 * scale,
                    borderRightWidth: 9 * scale,
                    borderBottomWidth: 18 * scale,
                    borderBottomColor: primary,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>

        {/* READOUT */}
        <View style={styles.readout}>
          <View style={styles.readoutRow}>
            <View style={styles.readoutCell}>
              <Text style={[styles.readoutLabel, { color: textSubtle }]}>Heading</Text>
              <Text style={[styles.readoutValue, { color: textColor }]}>
                {heading == null
                  ? '—'
                  : angleUnit === 'mils'
                  ? `${Math.round(degreesToMils(heading, { normalize: true }))} mils`
                  : `${Math.round(heading)}°`}
              </Text>
              {headingReferenceLabel ? (
                <Text style={[styles.readoutSub, { color: textMuted }]} numberOfLines={1}>
                  {headingReferenceLabel}
                </Text>
              ) : null}
            </View>

            <View style={styles.readoutCell}>
              <Text style={[styles.readoutLabel, { color: textSubtle }]}>Bearing</Text>
              <Text style={[styles.readoutValue, { color: textColor }]} numberOfLines={1}>
                {bearingText ?? '—'}
              </Text>
            </View>

            <View style={styles.readoutCell}>
              <Text style={[styles.readoutLabel, { color: textSubtle }]}>Distance</Text>
              <Text style={[styles.readoutValue, { color: textColor }]} numberOfLines={1}>
                {distanceText ?? '—'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    maxWidth: '100%',
  },
  card: {
    width: 360,
    borderWidth: 1.5,
    borderRadius: 18,
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
    borderWidth: 1.5,
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
    borderWidth: 1.5,
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
    borderWidth: 1.5,
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
  },
  targetPointer: {
    marginTop: 16,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
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
  },
  targetMarkDot: {
    marginTop: 8,
    width: 6,
    height: 6,
    borderRadius: 999,
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
});
