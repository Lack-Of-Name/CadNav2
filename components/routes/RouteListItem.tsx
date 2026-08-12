import { haversineMeters } from '@/components/map/MaplibreMap.utils';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, type ColorScheme } from '@/constants/theme';
import { computeRouteDistanceMeters, formatDistance } from '@/lib/geo';
import { latLonToMGRS } from '@/lib/mgrs';
import type { Checkpoint, RouteItem } from '@/types';
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { DenseButton } from './DenseButton';

type Props = {
  item: RouteItem;
  colorScheme: ColorScheme;
  expanded: boolean;
  isActive: boolean;
  checkpoints: Checkpoint[];
  selectedId: string | null;
  activeRouteLoop: boolean;
  onToggleExpand: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddWaypoint: () => void;
  onViewMap: () => void;
  onSelectCheckpoint: (id: string) => void;
  onRemoveCheckpoint: (id: string) => void;
  onEditCheckpoint: (cp: Checkpoint) => void;
  onShareCheckpoint: (cp: Checkpoint) => void;
  onSaveCheckpointLocation: (cp: Checkpoint) => void;
  onToggleLoop: () => void;
  onReverse: () => void;
  onRandomise: () => void;
  onSaveToLibrary: () => void;
  onShare: () => void;
  onShareQr: () => void;
  onClear: () => void;
};

function gridLabel(cp: Checkpoint): string {
  const ref = cp.mgrs?.trim();
  if (ref) return ref;
  return latLonToMGRS(cp.latitude, cp.longitude, 5);
}

export function RouteListItem({
  item,
  colorScheme,
  expanded,
  isActive,
  checkpoints,
  selectedId,
  activeRouteLoop,
  onToggleExpand,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
  onAddWaypoint,
  onViewMap,
  onSelectCheckpoint,
  onRemoveCheckpoint,
  onEditCheckpoint,
  onShareCheckpoint,
  onSaveCheckpointLocation,
  onToggleLoop,
  onReverse,
  onRandomise,
  onSaveToLibrary,
  onShare,
  onShareQr,
  onClear,
}: Props) {
  const theme = Colors[colorScheme];
  const routeColor = item.color ?? theme.primary;
  const cps = isActive ? checkpoints : (item.checkpoints ?? []);
  const loop = isActive ? activeRouteLoop : !!item.isLoop;
  const pointCount = cps.length;
  const totalDist = computeRouteDistanceMeters(cps, loop);
  const distLabel = totalDist > 0 ? formatDistance(totalDist) : '—';

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface }]}>
      <Pressable
        onPress={onToggleExpand}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.92 }]}
      >
        <View style={[styles.accent, { backgroundColor: routeColor }]} />
        <View style={styles.headerBody}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {item.title}
            </ThemedText>
            {isActive ? (
              <View style={[styles.statusPill, { borderColor: routeColor }]}>
                <ThemedText style={[styles.statusText, { color: routeColor }]}>ACTIVE</ThemedText>
              </View>
            ) : null}
          </View>
          {item.subtitle ? (
            <ThemedText style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
              {item.subtitle}
            </ThemedText>
          ) : null}
          <View style={styles.metaRow}>
            <ThemedText style={[styles.meta, { color: theme.textMuted }]}>
              {pointCount} WP · {distLabel}
              {loop ? ' · LOOP' : ''}
            </ThemedText>
          </View>
        </View>
        <IconSymbol
          name="chevron.right"
          size={16}
          color={theme.textMuted}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {expanded ? (
        <View style={[styles.body, { borderTopColor: theme.divider }]}>
          {isActive ? (
            <>
              {cps.length > 0 ? (
                <View style={[styles.waypointTable, { borderColor: theme.divider }]}>
                  {cps.map((cp, idx) => {
                    const isSelected = cp.id === selectedId;
                    const prev = idx > 0 ? cps[idx - 1] : null;
                    const legM = prev
                      ? haversineMeters(prev.latitude, prev.longitude, cp.latitude, cp.longitude)
                      : null;
                    return (
                      <View key={cp.id}>
                        {legM != null ? (
                          <View style={styles.legRow}>
                            <ThemedText style={[styles.legText, { color: theme.textSubtle }]}>
                              +{formatDistance(legM)}
                            </ThemedText>
                          </View>
                        ) : null}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => onSelectCheckpoint(cp.id)}
                          style={[
                            styles.waypointRow,
                            idx < cps.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
                            isSelected && { backgroundColor: `${routeColor}14` },
                          ]}
                        >
                          <ThemedText style={[styles.wpIndex, { color: theme.textMuted }]}>
                            {String(idx + 1).padStart(2, '0')}
                          </ThemedText>
                          <View style={styles.wpMain}>
                            {cp.label ? (
                              <ThemedText style={styles.wpLabel} numberOfLines={1}>
                                {cp.label}
                              </ThemedText>
                            ) : null}
                            <ThemedText
                              style={[styles.wpGrid, { color: theme.text }]}
                              numberOfLines={1}
                            >
                              {gridLabel(cp)}
                            </ThemedText>
                          </View>
                          <TouchableOpacity
                            onPress={() => onSaveCheckpointLocation(cp)}
                            hitSlop={8}
                            style={styles.wpAction}
                          >
                            <IconSymbol name="square.and.arrow.down" size={17} color={theme.textMuted} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onEditCheckpoint(cp)}
                            hitSlop={8}
                            style={styles.wpAction}
                            accessibilityLabel={`Edit checkpoint ${idx + 1}`}
                          >
                            <IconSymbol name="pencil" size={15} color={theme.textMuted} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onShareCheckpoint(cp)}
                            hitSlop={8}
                            style={styles.wpAction}
                            accessibilityLabel={`Share checkpoint ${idx + 1} as QR code`}
                          >
                            <IconSymbol name="qrcode" size={17} color={theme.textMuted} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onRemoveCheckpoint(cp.id)}
                            hitSlop={8}
                            style={styles.wpAction}
                          >
                            <IconSymbol name="xmark" size={15} color={theme.textSubtle} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ThemedText style={[styles.emptyWp, { color: theme.textMuted }]}>
                  No waypoints. Add one from the map or grid reference.
                </ThemedText>
              )}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionStrip}
                style={styles.actionScroll}
              >
                <DenseButton label="Waypoint" variant="primary" accentColor={routeColor} colorScheme={colorScheme} onPress={onAddWaypoint} />
                <DenseButton label="Map" variant="primary" accentColor={routeColor} colorScheme={colorScheme} onPress={onViewMap} />
                <DenseButton label="Close" colorScheme={colorScheme} onPress={onDeactivate} />
                <DenseButton label="Edit" colorScheme={colorScheme} onPress={onEdit} />
                {cps.length >= 2 ? (
                  <>
                    <DenseButton label={activeRouteLoop ? 'Unloop' : 'Loop'} colorScheme={colorScheme} onPress={onToggleLoop} />
                    <DenseButton label="Reverse" colorScheme={colorScheme} onPress={onReverse} />
                    <DenseButton label="Shuffle" colorScheme={colorScheme} onPress={onRandomise} />
                  </>
                ) : null}
                {cps.length > 0 ? (
                  <>
                    <DenseButton label="Library" colorScheme={colorScheme} onPress={onSaveToLibrary} />
                    <DenseButton label="QR" colorScheme={colorScheme} onPress={onShareQr} />
                    <DenseButton label="Share" colorScheme={colorScheme} onPress={onShare} />
                    <DenseButton label="Clear" variant="danger" colorScheme={colorScheme} onPress={onClear} />
                  </>
                ) : null}
                <DenseButton label="Delete" variant="danger" colorScheme={colorScheme} onPress={onDelete} />
              </ScrollView>
            </>
          ) : (
            <>
              {pointCount > 0 ? (
                <ThemedText style={[styles.inactiveHint, { color: theme.textMuted }]}>
                  {pointCount} waypoint{pointCount === 1 ? '' : 's'} stored
                </ThemedText>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionStrip}
              >
                <DenseButton label="Open" variant="primary" accentColor={routeColor} colorScheme={colorScheme} onPress={onActivate} />
                <DenseButton label="Edit" colorScheme={colorScheme} onPress={onEdit} />
                {pointCount > 0 ? (
                  <>
                    <DenseButton label="QR" colorScheme={colorScheme} onPress={onShareQr} />
                    <DenseButton label="Share" colorScheme={colorScheme} onPress={onShare} />
                  </>
                ) : null}
                <DenseButton label="Delete" variant="danger" colorScheme={colorScheme} onPress={onDelete} />
              </ScrollView>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
    minHeight: 56,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: 10,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  statusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
  },
  waypointTable: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 4,
  },
  wpIndex: {
    width: 28,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  wpMain: {
    flex: 1,
    minWidth: 0,
  },
  wpLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
  },
  wpGrid: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  wpAction: {
    padding: 8,
  },
  legRow: {
    paddingLeft: 28,
    paddingVertical: 2,
  },
  legText: {
    fontSize: 10,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  emptyWp: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    lineHeight: 18,
  },
  inactiveHint: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  actionScroll: {
    maxHeight: 44,
  },
  actionStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 4,
  },
});
