import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
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

const TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

function labelForDeg(deg: number) {
  if (deg === 0) return 'N';
  if (deg === 90) return 'E';
  if (deg === 180) return 'S';
  if (deg === 270) return 'W';
  if (deg % 30 === 0) return String(deg);
  return null;
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
  const heading = typeof headingDeg === 'number' ? normalize360(headingDeg) : null;

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

  if (!open) return null;

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: panelBg, borderColor }]}>
        {/* HEADER */}
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

        {/* COMPASS */}
        <View style={[styles.dial, { backgroundColor: background, borderColor }]}>
          <View style={[styles.ring, { transform: [{ rotate: ringRotation }] }]}>
            {TICKS.map((deg) => {
              const cardinal = deg % 90 === 0;
              const major = deg % 30 === 0;
              const label = labelForDeg(deg);

              return (
                <View key={deg} style={[styles.tickWrap, { transform: [{ rotate: `${deg}deg` }] }]}>
                  <View
                    style={[
                      styles.tick,
                      cardinal
                        ? styles.tickCardinal
                        : major
                        ? styles.tickMajor
                        : styles.tickMinor,
                      { backgroundColor: cardinal || major ? tickStrong : tick },
                    ]}
                  />

                  {label ? (
                    <View style={styles.ringLabelWrap}>
                      <Text
                        style={[
                          styles.ringLabel,
                          { color: cardinal ? tickStrong : textSubtle },
                          cardinal
                            ? styles.ringLabelCardinal
                            : styles.ringLabelDegree,
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.nLabelWrap}>
              <View style={[styles.nLabelPill, { borderColor, backgroundColor: background }]}>
                <Text style={[styles.nLabelText, { color: textColor }]}>N</Text>
              </View>
            </View>
          </View>

          <View style={[styles.needle, { backgroundColor: primary }]} />

          {pointerRotation ? (
            <View style={[styles.targetPointerWrap, { transform: [{ rotate: pointerRotation }] }]}>
              <View style={[styles.targetPointer, { borderBottomColor: primary }]} />
            </View>
          ) : null}
        </View>

        {/* READOUT BELOW COMPASS */}
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
    height: 10,
  },
  ringLabelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ringLabel: {
    marginTop: 2,
    fontWeight: '800',
  },
  ringLabelCardinal: {
    fontSize: 12,
  },
  ringLabelDegree: {
    fontSize: 9,
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
