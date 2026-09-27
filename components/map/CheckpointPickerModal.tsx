/**
 * CheckpointPickerModal — bottom-sheet list of the active route's checkpoints.
 *
 * Opened by long-pressing the checkpoint widget. Lets the user jump directly
 * to a checkpoint instead of stepping through the whole list with prev/next.
 */
import { Colors } from '@/constants/theme';
import { useGPS } from '@/hooks/gps';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Checkpoint } from '@/types';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { latLonToMGRS } from '@/lib/mgrs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { haversineMeters } from './MaplibreMap.utils';

type Props = {
  visible: boolean;
  checkpoints: Checkpoint[];
  selectedId: string | null;
  accentColor: string;
  onSelect: (id: string) => void;
  onZoomToCheckpoint: (cp: Checkpoint) => void;
  onClose: () => void;
};

function gridLabel(cp: Checkpoint): string {
  const ref = cp.mgrs?.trim();
  if (ref) return ref;
  return latLonToMGRS(cp.latitude, cp.longitude, 5);
}

function formatDistance(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function CheckpointPickerModal({
  visible,
  checkpoints,
  selectedId,
  accentColor,
  onSelect,
  onZoomToCheckpoint,
  onClose,
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { lastLocation } = useGPS();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.divider,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: palette.divider }]} />
          </View>

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]}>Pick checkpoint</Text>
              <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                {checkpoints.length} waypoint{checkpoints.length === 1 ? '' : 's'} in route
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={[styles.closeBtn, { borderColor: palette.divider, backgroundColor: palette.background }]}
              accessibilityLabel="Close"
            >
              <Text style={[styles.closeText, { color: palette.text }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {checkpoints.map((cp, idx) => {
              const selected = cp.id === selectedId;
              const label = cp.label?.trim() || `Waypoint ${idx + 1}`;
              const dist = lastLocation
                ? haversineMeters(
                    lastLocation.coords.latitude,
                    lastLocation.coords.longitude,
                    cp.latitude,
                    cp.longitude,
                  )
                : null;
              return (
                <Pressable
                  key={cp.id}
                  onPress={() => onSelect(cp.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
                  style={[
                    styles.row,
                    {
                      backgroundColor: selected ? `${accentColor}14` : palette.background,
                      borderColor: selected ? accentColor : palette.divider,
                    },
                  ]}
                >
                  <Text style={[styles.index, { color: palette.textMuted }]}>
                    {String(idx + 1).padStart(2, '0')}
                  </Text>
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowLabel, { color: selected ? accentColor : palette.text }]} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={[styles.rowGrid, { color: palette.textMuted }]} numberOfLines={1}>
                      {gridLabel(cp)}
                    </Text>
                  </View>
                  <Text style={[styles.rowDist, { color: palette.textMuted }]} numberOfLines={1}>
                    {formatDistance(dist)}
                  </Text>
                  <Pressable
                    onPress={() => onZoomToCheckpoint(cp)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Zoom to ${label} on map`}
                    style={styles.zoomBtn}
                  >
                    <IconSymbol name="magnifyingglass" size={17} color={palette.textMuted} />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '60%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 12,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: -1,
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 2,
    borderWidth: 1,
  },
  index: {
    width: 24,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowGrid: {
    fontSize: 11,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  rowDist: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  zoomBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
