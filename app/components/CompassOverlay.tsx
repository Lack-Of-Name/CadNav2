import React, { FC, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

type CompassOverlayProps = {
  open: boolean;
  onToggle: () => void;
  headingDeg?: number | null;
  targetBearingDeg?: number | null;
  targetLabel?: string | null;
  style?: ViewStyle;
};

const normalize360 = (value: number) => ((value % 360) + 360) % 360;

const CompassOverlay: FC<CompassOverlayProps> = ({
  open,
  onToggle,
  headingDeg,
  targetBearingDeg,
  targetLabel,
  style,
}) => {
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

  if (!open) {
    return (
      <View style={[styles.fabWrap, style]} pointerEvents="box-none">
        <Pressable
          style={styles.fab}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel="Open compass"
        >
          <Text style={styles.fabText}>N</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Compass</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {targetLabel ? `Target: ${targetLabel}` : 'No target selected'}
            </Text>
          </View>
          <Pressable
            style={styles.close}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel="Close compass"
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <View style={styles.dial}>
          <View style={[styles.ring, { transform: [{ rotate: ringRotation }] }]}>
            {TICKS.map((deg) => {
              const cardinal = deg % 90 === 0;
              return (
                <View key={deg} style={[styles.tickWrap, { transform: [{ rotate: `${deg}deg` }] }]}>
                  <View style={[styles.tick, cardinal ? styles.tickCardinal : styles.tickMinor]} />
                </View>
              );
            })}
            <View style={styles.nLabelWrap}>
              <View style={styles.nLabelPill}>
                <Text style={styles.nLabelText}>N</Text>
              </View>
            </View>
          </View>

          {/* Fixed needle (points up). */}
          <View style={styles.needle} />

          {pointerRotation && (
            <View style={[styles.targetPointerWrap, { transform: [{ rotate: pointerRotation }] }]}>
              <View style={styles.targetPointer} />
            </View>
          )}

          <View style={styles.readout}>
            <Text style={styles.readoutLabel}>Heading</Text>
            <Text style={styles.readoutValue}>{heading == null ? '—' : `${Math.round(heading)}°`}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default CompassOverlay;

const TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: 12,
    bottom: 86,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fabText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  wrap: {
    position: 'absolute',
    right: 12,
    bottom: 86,
  },
  card: {
    width: 260,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
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
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#475569',
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  closeText: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: -1,
  },
  dial: {
    marginTop: 12,
    alignSelf: 'center',
    width: 172,
    height: 172,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    marginTop: 10,
    backgroundColor: '#94a3b8',
    borderRadius: 999,
  },
  tickCardinal: {
    width: 2,
    height: 16,
    backgroundColor: '#64748b',
  },
  tickMinor: {
    width: 1,
    height: 10,
  },
  nLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    alignItems: 'center',
  },
  nLabelPill: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  needle: {
    position: 'absolute',
    width: 2,
    height: 62,
    top: 18,
    backgroundColor: '#0f172a',
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
    marginTop: 14,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#0f172a',
  },
  readout: {
    position: 'absolute',
    bottom: 14,
    alignItems: 'center',
  },
  readoutLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  readoutValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
});
