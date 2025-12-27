import { FC, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';

type Props = {
  open: boolean;
  onToggle: () => void;
  headingDeg?: number | null;
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

const CompassOverlay: FC<Props> = ({
  open,
  onToggle,
  headingDeg,
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
}) => {
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

  if (!open) {
    return (
      <View style={[styles.fabWrap, style]} pointerEvents="box-none">
        <Pressable
          style={[styles.fab, { backgroundColor: panelBg, borderColor }]}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel="Open compass"
        >
          <Text style={[styles.fabText, { color: textColor }]}>N</Text>
        </Pressable>
      </View>
    );
  }

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
              const cardinal = deg % 90 === 0;
              const major = deg % 30 === 0;
              const label = labelForDeg(deg);

              const tickLen = (cardinal ? 30 : major ? 22 : 12) * scale;
              const tickWidth = (cardinal ? 3 : major ? 2 : 1) * scale;
              const tickMarginTop = 14 * scale;

              const labelFontSize = Math.max(9, (cardinal ? 13 : 10) * scale);
              const labelMarginTop = 2 * scale;

              const nTop = 8 * scale;
              return (
                <View key={deg} style={[styles.tickWrap, { transform: [{ rotate: `${deg}deg` }] }]}>
                  <View
                    style={[
                      styles.tick,
                      {
                        marginTop: tickMarginTop,
                        width: tickWidth,
                        height: tickLen,
                        backgroundColor: cardinal || major ? tickStrong : tick,
                      },
                    ]}
                  />

                  {label ? (
                    <View style={styles.ringLabelWrap}>
                      <Text
                        style={[
                          styles.ringLabel,
                          { color: cardinal ? tickStrong : textSubtle },
                          { fontSize: labelFontSize, marginTop: labelMarginTop },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  ) : null}
                  {deg === 0 ? (
                    <View style={[styles.nLabelWrap, { top: nTop }]}>
                      <View style={[styles.nLabelPill, { borderColor, backgroundColor: background }]}>
                        <Text style={[styles.nLabelText, { color: textColor, fontSize: Math.max(9, 11 * scale) }]}>N</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={[styles.needle, { backgroundColor: primary, height: 112 * scale, top: 22 * scale }]} />

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

          <View style={styles.readout}>
            <View style={styles.readoutRow}>
              <View style={styles.readoutCell}>
                <Text style={[styles.readoutLabel, { color: textSubtle }]}>Heading</Text>
                <Text style={[styles.readoutValue, { color: textColor }]}>
                  {heading == null ? '—' : `${Math.round(heading)}°`}
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
    </View>
  );
};

export default CompassOverlay;

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '800',
  },
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
    width: 280,
    height: 280,
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
    marginTop: 14,
    borderRadius: 999,
  },
  tickCardinal: {
    width: 3,
    height: 30,
  },
  tickMajor: {
    width: 2,
    height: 22,
  },
  tickMinor: {
    width: 1,
    height: 12,
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
    fontSize: 13,
  },
  ringLabelDegree: {
    fontSize: 10,
  },
  nLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
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
    height: 112,
    top: 22,
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
    marginTop: 18,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  readout: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center',
  },
  readoutRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
