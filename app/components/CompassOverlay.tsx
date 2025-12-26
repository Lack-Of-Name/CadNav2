import React, { FC, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../state/ThemeContext';
import { BOTTOM_PAGE_SELECTOR_CLEARANCE_PX } from './BottomPageSelector';

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
  const { theme } = useAppTheme();
  const panelBg = theme.isDark ? theme.colors.background : theme.colors.surface;
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
          style={[styles.fab, { backgroundColor: panelBg, borderColor: theme.colors.border }]}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel="Open compass"
        >
          <Text style={[styles.fabText, { color: theme.colors.text }]}>N</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: panelBg, borderColor: theme.colors.border }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Compass</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {targetLabel ? `Target: ${targetLabel}` : 'No target selected'}
            </Text>
          </View>
          <Pressable
            style={[styles.close, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel="Close compass"
          >
            <Text style={[styles.closeText, { color: theme.colors.text }]}>×</Text>
          </Pressable>
        </View>

        <View style={[styles.dial, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
        >
          <View style={[styles.ring, { transform: [{ rotate: ringRotation }] }]}>
            {TICKS.map((deg) => {
              const cardinal = deg % 90 === 0;
              return (
                <View key={deg} style={[styles.tickWrap, { transform: [{ rotate: `${deg}deg` }] }]}>
                  <View
                    style={[
                      styles.tick,
                      cardinal ? styles.tickCardinal : styles.tickMinor,
                      { backgroundColor: cardinal ? theme.colors.tickStrong : theme.colors.tick },
                    ]}
                  />
                </View>
              );
            })}
            <View style={styles.nLabelWrap}>
              <View
                style={[styles.nLabelPill, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              >
                <Text style={[styles.nLabelText, { color: theme.colors.text }]}>N</Text>
              </View>
            </View>
          </View>

          {/* Fixed needle (points up). */}
          <View style={[styles.needle, { backgroundColor: theme.colors.primary }]} />

          {pointerRotation && (
            <View style={[styles.targetPointerWrap, { transform: [{ rotate: pointerRotation }] }]}>
              <View style={[styles.targetPointer, { borderBottomColor: theme.colors.primary }]} />
            </View>
          )}

          <View style={styles.readout}>
            <Text style={[styles.readoutLabel, { color: theme.colors.textSubtle }]}>Heading</Text>
            <Text style={[styles.readoutValue, { color: theme.colors.text }]}>
              {heading == null ? '—' : `${Math.round(heading)}°`}
            </Text>
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
    bottom: BOTTOM_PAGE_SELECTOR_CLEARANCE_PX,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '800',
  },
  wrap: {
    position: 'absolute',
    right: 12,
    bottom: BOTTOM_PAGE_SELECTOR_CLEARANCE_PX,
  },
  card: {
    width: 260,
    borderWidth: 1,
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
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: -1,
  },
  dial: {
    marginTop: 12,
    alignSelf: 'center',
    width: 172,
    height: 172,
    borderRadius: 999,
    borderWidth: 1,
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
    borderRadius: 999,
  },
  tickCardinal: {
    width: 2,
    height: 16,
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
    height: 62,
    top: 18,
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
  },
  readout: {
    position: 'absolute',
    bottom: 14,
    alignItems: 'center',
  },
  readoutLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  readoutValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
  },
});
