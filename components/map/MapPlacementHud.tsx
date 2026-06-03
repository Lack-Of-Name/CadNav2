import { DenseButton } from '@/components/routes/DenseButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, type ColorScheme } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type PlacementHudMode = 'idle' | 'placing' | 'nav';

type Props = {
  colorScheme: ColorScheme;
  mode: PlacementHudMode;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  rightInset?: number;
  /** Primary line (target name or status). */
  title: string;
  /** Secondary metrics line. */
  detail: string;
  /** Large bearing in mils (nav mode). */
  bearingMils: string | null;
  bearingDegreesText: string | null;
  bearingRotationDeg: number | null;
  distanceText: string | null;
  gridRefText: string | null;
  angleUnit: 'mils' | 'degrees';
  onSetTarget: () => void;
  onDonePlacing: () => void;
  onCancelPlacing: () => void;
  onPrevTarget?: () => void;
  onNextTarget?: () => void;
  showTargetStepper?: boolean;
  /** 0–1 approach progress toward target. */
  approachProgress?: number | null;
};

export function MapPlacementHud({
  colorScheme,
  mode,
  accentColor,
  textColor,
  mutedColor,
  title,
  detail,
  bearingMils,
  bearingDegreesText,
  bearingRotationDeg,
  distanceText,
  gridRefText,
  angleUnit,
  rightInset = 0,
  onSetTarget,
  onDonePlacing,
  onCancelPlacing,
  onPrevTarget,
  onNextTarget,
  showTargetStepper,
  approachProgress,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = Colors[colorScheme];
  const panelBg = colorScheme === 'dark' ? 'rgba(18,18,20,0.97)' : 'rgba(255,255,255,0.98)';

  const bearingPrimary =
    angleUnit === 'mils'
      ? bearingMils ?? '—'
      : bearingDegreesText != null
        ? `${bearingDegreesText}°`
        : '—';
  const bearingLabel = angleUnit === 'mils' ? 'MILS' : 'DEG';

  return (
    <View
      style={[
        styles.wrap,
        {
          left: insets.left + 10,
          right: insets.right + 10 + rightInset,
          bottom: insets.bottom + 10,
          backgroundColor: panelBg,
          borderColor: theme.divider,
        },
      ]}
      pointerEvents="box-none"
    >
      {mode === 'placing' ? (
        <View style={styles.placingRow}>
          <View style={[styles.liveDot, { backgroundColor: accentColor }]} />
          <View style={styles.placingCopy}>
            <Text style={[styles.placingTitle, { color: textColor }]}>TAP MAP TO PLACE</Text>
            <Text style={[styles.placingSub, { color: mutedColor }]} numberOfLines={1}>
              Single temporary target · replaces current
            </Text>
          </View>
          <DenseButton label="Done" variant="primary" accentColor={accentColor} colorScheme={colorScheme} onPress={onDonePlacing} />
          <DenseButton label="Cancel" colorScheme={colorScheme} onPress={onCancelPlacing} />
        </View>
      ) : mode === 'nav' ? (
        <>
          <View style={styles.navRow}>
            <View style={[styles.bearingBlock, { borderColor: theme.divider }]}>
              <View style={[styles.bearingArrow, { transform: [{ rotate: `${bearingRotationDeg ?? 0}deg` }] }]}>
                <IconSymbol name="arrow.up" size={36} color={accentColor} />
              </View>
              <Text style={[styles.bearingValue, { color: textColor }]}>{bearingPrimary}</Text>
              <Text style={[styles.bearingUnit, { color: mutedColor }]}>{bearingLabel}</Text>
            </View>
            <View style={styles.navCopy}>
              <Text style={[styles.navTitle, { color: textColor }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.navDetail, { color: mutedColor }]} numberOfLines={1}>
                {distanceText ?? '—'} · {gridRefText ?? '—'}
              </Text>
              <Text style={[styles.navDetail, { color: mutedColor }]} numberOfLines={1}>
                {detail}
              </Text>
            </View>
            {showTargetStepper && onPrevTarget && onNextTarget ? (
              <View style={styles.stepper}>
                <Pressable
                  onPress={onPrevTarget}
                  style={[styles.stepBtn, { borderColor: theme.divider }]}
                  hitSlop={6}
                >
                  <IconSymbol name="chevron.left" size={16} color={textColor} />
                </Pressable>
                <Pressable
                  onPress={onNextTarget}
                  style={[styles.stepBtn, { borderColor: theme.divider }]}
                  hitSlop={6}
                >
                  <IconSymbol name="chevron.right" size={16} color={textColor} />
                </Pressable>
              </View>
            ) : null}
          </View>
          {approachProgress != null && approachProgress > 0 ? (
            <View style={[styles.progressTrack, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={[styles.progressFill, { width: `${Math.min(1, approachProgress) * 100}%`, backgroundColor: accentColor }]} />
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <DenseButton label="New target" variant="primary" accentColor={accentColor} colorScheme={colorScheme} onPress={onSetTarget} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <View style={styles.idleRow}>
          <View style={styles.idleCopy}>
            <Text style={[styles.idleLabel, { color: mutedColor }]}>TEMP TARGET</Text>
            <Text style={[styles.idleTitle, { color: textColor }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.idleSub, { color: mutedColor }]} numberOfLines={2}>
              {detail}
            </Text>
          </View>
          <DenseButton label="Set" variant="primary" accentColor={accentColor} colorScheme={colorScheme} onPress={onSetTarget} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  placingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  placingCopy: {
    flex: 1,
    minWidth: 0,
  },
  placingTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  placingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  idleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  idleCopy: {
    flex: 1,
    minWidth: 0,
  },
  idleLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  idleTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  idleSub: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  bearingBlock: {
    width: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  bearingArrow: {
    marginBottom: 4,
  },
  bearingValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  bearingUnit: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  navCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    gap: 2,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  navDetail: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  stepper: {
    justifyContent: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  progressTrack: {
    marginTop: 8,
    height: 3,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
});
