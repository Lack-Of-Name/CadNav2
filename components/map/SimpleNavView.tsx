import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useCheckpoints } from '@/hooks/checkpoints';
import { resolveDisplayHeading, useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { degreesToMils } from './converter';
import { bearingDegrees, haversineMeters } from './MaplibreMap.utils';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCompassAccuracy } from '@/hooks/useCompassAccuracy';
import { CompassWarningSheet } from './CompassWarningSheet';
import Svg, { Path } from 'react-native-svg';

function CompassArrow({ rotationDeg, size, color }: { rotationDeg: number | null; size: number; color: string }) {
  if (rotationDeg == null) return <Text style={styles.noFix}>—</Text>;
  return (
    <View style={[styles.arrowContainer, { width: size, height: size }]}>
      <View style={{ transform: [{ rotate: `${rotationDeg}deg` }] }}>
        <IconSymbol name="arrow.up" size={Math.round(size * 0.65)} color={color} />
      </View>
    </View>
  );
}

function formatDistance(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters >= 1000) {
    const km = meters / 1000;
    const decimals = km >= 10 ? 0 : 1;
    return `${km.toFixed(decimals)} km`;
  }
  return `${Math.round(meters)} m`;
}

export default function SimpleNavView() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lastLocation, requestFreshFix } = useGPS();
  const { checkpoints, selectCheckpoint, selectedId, selectedCheckpoint } = useCheckpoints();
  const { angleUnit, mapHeading } = useSettings();
  const compassAccuracy = useCompassAccuracy();
  const [warningOpen, setWarningOpen] = useState(false);

  const [trackedTargetId, setTrackedTargetId] = useState<string | null>(null);
  const [targetStartDistance, setTargetStartDistance] = useState<number | null>(null);

  const selectedIndex = selectedCheckpoint
    ? checkpoints.findIndex((c) => c.id === selectedCheckpoint.id)
    : -1;

  const compassHeadingDeg = useMemo(() => {
    if (!lastLocation) return null;
    const resolved = resolveDisplayHeading(
      mapHeading,
      lastLocation.coords.magHeading ?? null,
      lastLocation.coords.trueHeading ?? null,
    );
    return resolved ? resolved.value : null;
  }, [lastLocation, mapHeading]);

  const compassTargetBearingDeg = useMemo(() => {
    if (!lastLocation || !selectedCheckpoint) return null;
    return bearingDegrees(
      lastLocation.coords.latitude,
      lastLocation.coords.longitude,
      selectedCheckpoint.latitude,
      selectedCheckpoint.longitude
    );
  }, [lastLocation, selectedCheckpoint]);

  const compassRelativeBearingDeg = useMemo(() => {
    if (compassTargetBearingDeg == null) return null;
    if (compassHeadingDeg == null) return compassTargetBearingDeg;
    return ((compassTargetBearingDeg - compassHeadingDeg) % 360 + 360) % 360;
  }, [compassTargetBearingDeg, compassHeadingDeg]);

  const compassDistanceMeters = useMemo(() => {
    if (!lastLocation || !selectedCheckpoint) return null;
    return haversineMeters(
      lastLocation.coords.latitude,
      lastLocation.coords.longitude,
      selectedCheckpoint.latitude,
      selectedCheckpoint.longitude
    );
  }, [lastLocation, selectedCheckpoint]);

  useEffect(() => {
    if (selectedId && lastLocation && trackedTargetId !== selectedId) {
      const sp = checkpoints.find((c) => c.id === selectedId);
      if (sp) {
        const dist = haversineMeters(
          lastLocation.coords.latitude,
          lastLocation.coords.longitude,
          sp.latitude,
          sp.longitude
        );
        if (Number.isFinite(dist)) {
          setTrackedTargetId(selectedId);
          setTargetStartDistance(dist);
        }
      }
    } else if (!selectedId && trackedTargetId !== null) {
      setTrackedTargetId(null);
      setTargetStartDistance(null);
    }
  }, [selectedId, lastLocation, checkpoints, trackedTargetId]);

  const currentProgress = (targetStartDistance && compassDistanceMeters != null && targetStartDistance > 0)
    ? Math.max(0, Math.min(1, 1 - (compassDistanceMeters / targetStartDistance)))
    : 0;

  const headingRefLabel = (() => {
    if (compassHeadingDeg == null || !lastLocation) return null;
    const resolved = resolveDisplayHeading(
      mapHeading,
      lastLocation.coords.magHeading ?? null,
      lastLocation.coords.trueHeading ?? null,
    );
    return resolved?.reference === 'true' ? 'True' : 'Magnetic';
  })();

  const bearingText = compassTargetBearingDeg != null
    ? angleUnit === 'mils'
      ? `${Math.round(degreesToMils(compassTargetBearingDeg, { normalize: true }))} mils`
      : `${Math.round(compassTargetBearingDeg)}°`
    : '—';

  const targetLabel = selectedCheckpoint
    ? selectedCheckpoint.label?.trim() || `Waypoint ${selectedIndex + 1}`
    : 'No target selected';

  const positionText = lastLocation
    ? `${lastLocation.coords.latitude.toFixed(5)}, ${lastLocation.coords.longitude.toFixed(5)}`
    : 'No GPS fix';

  const headingText = compassHeadingDeg != null
    ? angleUnit === 'mils'
      ? `${Math.round(degreesToMils(compassHeadingDeg, { normalize: true }))} mils`
      : `${Math.round(compassHeadingDeg)}°`
    : '—';

  const handleNextTarget = () => {
    if (checkpoints.length <= 1) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const next = (idx + 1) % checkpoints.length;
    void selectCheckpoint(checkpoints[next].id);
  };

  const handlePrevTarget = () => {
    if (checkpoints.length <= 1) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const prev = (idx - 1 + checkpoints.length) % checkpoints.length;
    void selectCheckpoint(checkpoints[prev].id);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar animated barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 62, borderBottomColor: theme.divider }]}>
        <Text style={[styles.modeLabel, { color: theme.textMuted }]}>Super Power Saving</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {compassAccuracy.hasWarning ? (
            <TouchableOpacity
              onPress={() => setWarningOpen(true)}
              accessibilityLabel={`Compass inaccurate: ${compassAccuracy.count} issues`}
              style={[
                styles.warningPill,
                {
                  backgroundColor: compassAccuracy.hasCritical ? theme.error : theme.warning,
                  borderColor: theme.surface,
                },
              ]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2.8 L21.2 20 H2.8 Z" fill="white" />
                <Path d="M11 8.5 H13 V14 H11 Z" fill={compassAccuracy.hasCritical ? theme.error : theme.warning} />
                <Path d="M11 16 H13 V18 H11 Z" fill={compassAccuracy.hasCritical ? theme.error : theme.warning} />
              </Svg>
              <Text style={styles.warningPillText}>{compassAccuracy.count}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => router.push('/routes')}
            style={[styles.headerBtn, { borderColor: theme.divider, backgroundColor: theme.surface }]}
          >
            <Text style={[styles.headerBtnText, { color: theme.text }]}>Routes</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.main}>
        {selectedCheckpoint ? (
          <>
            <View style={styles.compassSection}>
              <CompassArrow rotationDeg={compassRelativeBearingDeg} size={100} color={theme.primary} />
              <Text style={[styles.targetLabel, { color: theme.text }]}>{targetLabel}</Text>
              <View style={styles.bearingRow}>
                <Text style={[styles.bearingValue, { color: theme.primary }]}>{bearingText}</Text>
                <Text style={[styles.bearingUnit, { color: theme.textMuted }]}>to target</Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Heading</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{headingText}</Text>
                {headingRefLabel && <Text style={[styles.infoSuffix, { color: theme.textSubtle }]}>{headingRefLabel}</Text>}
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Distance</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{formatDistance(compassDistanceMeters)}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Position</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{positionText}</Text>
              </View>
            </View>

            <View style={styles.progressSection}>
              <View style={[styles.progressBg, { backgroundColor: theme.divider }]}>
                <View style={[styles.progressFill, { width: `${currentProgress * 100}%`, backgroundColor: theme.primary }]} />
              </View>
              <Text style={[styles.progressText, { color: theme.textMuted }]}>
                {Math.round(currentProgress * 100)}%
              </Text>
            </View>

            <View style={styles.controls}>
              <TouchableOpacity
                onPress={handlePrevTarget}
                style={[styles.controlBtn, { borderColor: theme.divider, backgroundColor: theme.surface }]}
                disabled={checkpoints.length <= 1}
              >
                <Text style={[styles.controlBtnText, { color: checkpoints.length <= 1 ? theme.textSubtle : theme.text }]}>◀</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void requestFreshFix()}
                style={[styles.controlBtn, { borderColor: theme.primary, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.controlBtnText, { color: theme.primary }]}>↻</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNextTarget}
                style={[styles.controlBtn, { borderColor: theme.divider, backgroundColor: theme.surface }]}
                disabled={checkpoints.length <= 1}
              >
                <Text style={[styles.controlBtnText, { color: checkpoints.length <= 1 ? theme.textSubtle : theme.text }]}>▶</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.refreshLabel, { color: theme.textSubtle }]}>
              Prev · Refresh GPS · Next
            </Text>
          </>
        ) : (
          <View style={styles.noTarget}>
            <Text style={[styles.noTargetText, { color: theme.text }]}>No navigation target set</Text>
            <Text style={[styles.noTargetHint, { color: theme.textMuted }]}>Set a target from Routes</Text>
            <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.divider, width: '100%', marginTop: 16 }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Heading</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{headingText}</Text>
                {headingRefLabel && <Text style={[styles.infoSuffix, { color: theme.textSubtle }]}>{headingRefLabel}</Text>}
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Position</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{positionText}</Text>
              </View>
            </View>
            <View style={[styles.controls, { marginTop: 16 }]}>
              <TouchableOpacity
                onPress={() => void requestFreshFix()}
                style={[styles.controlBtn, { borderColor: theme.primary, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.controlBtnText, { color: theme.primary }]}>↻</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.refreshLabel, { color: theme.textSubtle }]}>Refresh GPS</Text>
            <TouchableOpacity
              onPress={() => router.push('/routes')}
              style={[styles.goRoutesBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.goRoutesBtnText, { color: '#fff' }]}>Open Routes</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {Platform.OS !== 'web' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 8, borderTopColor: theme.divider }]}>
          <Text style={[styles.footerText, { color: theme.textSubtle }]}>
            Map disabled — Super Power Saving mode
          </Text>
          <Text style={[styles.footerText, { color: theme.textSubtle }]}>
            Change in Settings → Location
          </Text>
        </View>
      )}

      <CompassWarningSheet
        visible={warningOpen}
        onClose={() => setWarningOpen(false)}
        activeRules={compassAccuracy.warningRules}
        allRules={compassAccuracy.results}
        onRefresh={() => void requestFreshFix()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  headerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  compassSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noFix: {
    fontSize: 48,
    opacity: 0.3,
  },
  targetLabel: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  bearingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bearingValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  bearingUnit: {
    fontSize: 16,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 15,
    width: 80,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoSuffix: {
    fontSize: 13,
    marginLeft: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  progressBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnText: {
    fontSize: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 22,
    includeFontPadding: false,
  },
  refreshLabel: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
  noTarget: {
    alignItems: 'center',
    gap: 12,
  },
  noTargetText: {
    fontSize: 20,
    fontWeight: '600',
  },
  noTargetHint: {
    fontSize: 15,
  },
  goRoutesBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goRoutesBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  footerText: {
    fontSize: 12,
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  warningPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
