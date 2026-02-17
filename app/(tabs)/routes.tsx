import { AddRoutePanel } from '@/components/AddRoutePanel';
import { alert as showAlert } from '@/components/alert';
import { EditRouteModal } from '@/components/EditRouteModal';
import { GridReferenceModal } from '@/components/GridReferenceModal';
import { haversineMeters } from '@/components/map/MaplibreMap.general';
import { ProjectPointModal } from '@/components/ProjectPointModal';
import { SavedRoutesModal } from '@/components/SavedRoutesModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import StyledButton from '@/components/ui/StyledButton';
import { Colors } from '@/constants/theme';
import { Checkpoint, SavedLocation, SavedRoute, useCheckpoints } from '@/hooks/checkpoints';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type RouteItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  checkpoints?: Checkpoint[];
};

const ROUTES_KEY = 'APP_ROUTES';

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
}

function computeTotalDistance(cps: Checkpoint[]): number {
  if (cps.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < cps.length; i++) {
    total += haversineMeters(
      cps[i - 1].latitude, cps[i - 1].longitude,
      cps[i].latitude, cps[i].longitude,
    );
  }
  return total;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export default function RoutesScreen() {
  const router = useRouter();
  const {
    requestPlacementMode,
    addCheckpoint,
    checkpoints,
    removeCheckpoint,
    reorderCheckpoints,
    setActiveRouteColor,
    setCheckpointsColor,
    clearActiveRoute,
  } = useCheckpoints();

  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RouteItem | null>(null);
  const [addPanelVisible, setAddPanelVisible] = useState(false);
  const [referenceModalVisible, setReferenceModalVisible] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [savedRoutesModalVisible, setSavedRoutesModalVisible] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  // Prevents the sync effect from firing redundantly when loading a route
  const isSyncingRef = useRef(false);

  // ── Route activation ──────────────────────────────────────────────────

  function activateRoute(routeItem: RouteItem) {
    // Save current active route before switching
    syncCheckpointsToRoute();

    isSyncingRef.current = true;
    const cps = routeItem.checkpoints ?? [];
    setActiveRouteId(routeItem.id);
    setActiveRouteColor(routeItem.color ?? null);
    reorderCheckpoints(cps);
    if (routeItem.color) setCheckpointsColor(routeItem.color);
    setTimeout(() => { isSyncingRef.current = false; }, 150);
  }

  function deactivateRoute() {
    syncCheckpointsToRoute();
    isSyncingRef.current = true;
    setActiveRouteId(null);
    setActiveRouteColor(null);
    clearActiveRoute();
    setTimeout(() => { isSyncingRef.current = false; }, 150);
  }

  function syncCheckpointsToRoute() {
    if (!activeRouteId) return;
    setRoutes(r => r.map(it =>
      it.id === activeRouteId
        ? { ...it, checkpoints: [...checkpoints] }
        : it,
    ));
  }

  // Auto-sync checkpoint changes back to the active route
  useEffect(() => {
    if (!activeRouteId || isSyncingRef.current) return;
    setRoutes(r => r.map(it =>
      it.id === activeRouteId
        ? { ...it, checkpoints: [...checkpoints] }
        : it,
    ));
  }, [checkpoints, activeRouteId]);

  // ── Add / import points ───────────────────────────────────────────────

  function handleAddPanelSelect(option: string) {
    setAddPanelVisible(false);
    if (option === 'place') {
      void requestPlacementMode();
      router.push('/');
    } else if (option === 'reference') {
      setReferenceModalVisible(true);
    } else if (option === 'project') {
      setProjectModalVisible(true);
    } else if (option === 'saved') {
      setSavedRoutesModalVisible(true);
    }
  }

  function handleAddPoint(location: { latitude: number; longitude: number }) {
    addCheckpoint(location.latitude, location.longitude);
    setReferenceModalVisible(false);
    setProjectModalVisible(false);
    router.push('/');
  }

  function handleAddSavedRoute(route: SavedRoute) {
    route.checkpoints.forEach(cp => {
      addCheckpoint(cp.latitude, cp.longitude);
    });
    setSavedRoutesModalVisible(false);
    router.push('/');
  }

  function handleAddSavedLocation(location: SavedLocation) {
    addCheckpoint(location.latitude, location.longitude);
    setSavedRoutesModalVisible(false);
    router.push('/');
  }

  // ── Route editing ─────────────────────────────────────────────────────

  function handleOpenAddPoints(routeItem: RouteItem) {
    if (activeRouteId !== routeItem.id) {
      activateRoute(routeItem);
    }
    setAddPanelVisible(true);
  }

  function handleRemovePoint(cpId: string) {
    removeCheckpoint(cpId);
  }

  function handleReverseRoute() {
    if (checkpoints.length < 2) return;
    reorderCheckpoints([...checkpoints].reverse());
  }

  function handleClearPoints() {
    if (checkpoints.length === 0) return;
    void showAlert({
      title: 'Clear all points?',
      message: `Remove all ${checkpoints.length} points from this route?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearActiveRoute() },
      ],
    });
  }

  function handleViewOnMap() {
    router.push('/');
  }

  // ── Route CRUD ────────────────────────────────────────────────────────

  function handleSaveRoute(title: string, subtitle: string, icon: string, color: string) {
    if (editingId) {
      setRoutes(r => r.map(it => (it.id === editingId ? { ...it, title, subtitle: subtitle || undefined, icon: icon || undefined, color } : it)));
      if (editingId === activeRouteId) {
        setActiveRouteColor(color);
        setCheckpointsColor(color);
      }
    } else {
      const item: RouteItem = {
        id: String(Date.now()),
        title,
        subtitle: subtitle || undefined,
        icon: icon || undefined,
        color,
        checkpoints: [],
      };

      // Save current route before switching
      syncCheckpointsToRoute();

      setRoutes(r => [item, ...r]);

      // Auto-activate the new route
      isSyncingRef.current = true;
      setActiveRouteId(item.id);
      setActiveRouteColor(color);
      clearActiveRoute();
      if (color) setCheckpointsColor(color);
      setTimeout(() => { isSyncingRef.current = false; }, 150);
    }
    setOpen(false);
    setEditingId(null);
    setEditingItem(null);
  }

  function handleEdit(item: RouteItem) {
    setEditingItem(item);
    setEditingId(item.id);
    setOpen(true);
  }

  function handleRemove(id: string) {
    void showAlert({
      title: 'Delete route?',
      message: 'This will permanently remove this route and all its points.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setRoutes(r => r.filter(it => it.id !== id));
            if (activeRouteId === id) {
              isSyncingRef.current = true;
              setActiveRouteId(null);
              setActiveRouteColor(null);
              clearActiveRoute();
              setTimeout(() => { isSyncingRef.current = false; }, 150);
            }
          },
        },
      ],
    });
  }

  // ── Persistence ───────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ROUTES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as RouteItem[];
          if (Array.isArray(parsed)) setRoutes(parsed);
        }
      } catch (err) {
        void showAlert({ title: 'Routes', message: String(err) });
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
      } catch (err) {
        void showAlert({ title: 'Routes save', message: String(err) });
      }
    })();
  }, [routes]);

  // ── Theme ─────────────────────────────────────────────────────────────

  const cardBg = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const safeBg = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const colorScheme = useColorScheme() ?? 'light';
  const subtleBg = useThemeColor({ light: '#f5f5f5', dark: '#1c1c1e' }, 'background');
  const iconColor = useThemeColor({}, 'icon');

  // ── Render ────────────────────────────────────────────────────────────

  function renderRouteCard({ item }: { item: RouteItem }) {
    const isActive = activeRouteId === item.id;
    const cps = isActive ? checkpoints : (item.checkpoints ?? []);
    const pointCount = cps.length;
    const totalDist = computeTotalDistance(cps);
    const distLabel = totalDist > 0 ? formatDistance(totalDist) : null;
    const routeColor = item.color ?? Colors[colorScheme].tint;

    return (
      <View style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isActive ? routeColor : borderColor,
          borderWidth: isActive ? 2 : 1,
          alignSelf: 'center',
          width: '98%',
        },
      ]}>
        <Collapsible
          header={
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <ThemedText style={{ fontSize: 28 }}>{item.icon ?? '📍'}</ThemedText>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.routeTitleRow}>
                  <ThemedText type="defaultSemiBold" style={{ flexShrink: 1 }}>{item.title}</ThemedText>
                  <View style={[styles.routeColorDot, { backgroundColor: routeColor }]} />
                  {isActive && (
                    <View style={[styles.activeBadge, { backgroundColor: routeColor }]}>
                      <ThemedText style={styles.activeBadgeText}>ACTIVE</ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={styles.cardSubline}>
                  {item.subtitle ? `${item.subtitle} · ` : ''}
                  {pointCount} {pointCount === 1 ? 'point' : 'points'}
                  {distLabel ? ` · ${distLabel}` : ''}
                </ThemedText>
              </View>
            </View>
          }
        >
          <View style={{ marginTop: 8 }}>
            {isActive ? renderActiveContent(item, routeColor) : renderInactiveContent(item)}
          </View>
        </Collapsible>
      </View>
    );
  }

  function renderActiveContent(item: RouteItem, routeColor: string) {
    return (
      <View>
        {/* ── Checkpoint list ── */}
        {checkpoints.length > 0 ? (
          <View style={[styles.cpList, { borderColor, backgroundColor: subtleBg }]}>
            {checkpoints.map((cp, idx) => (
              <View
                key={cp.id}
                style={[
                  styles.cpRow,
                  idx < checkpoints.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                ]}
              >
                <View style={[styles.cpIndex, { backgroundColor: routeColor }]}>
                  <ThemedText style={styles.cpIndexText}>{idx + 1}</ThemedText>
                </View>
                <View style={styles.cpInfo}>
                  {cp.label ? <ThemedText style={styles.cpLabel}>{cp.label}</ThemedText> : null}
                  <ThemedText style={styles.cpCoords}>{formatCoords(cp.latitude, cp.longitude)}</ThemedText>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemovePoint(cp.id)}
                  style={styles.cpDeleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconSymbol name="xmark" size={16} color={iconColor} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.emptyHint}>No points yet — add one below</ThemedText>
        )}

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <StyledButton variant="primary" onPress={() => handleOpenAddPoints(item)} style={styles.actionBtn}>
            Add Point
          </StyledButton>
          <StyledButton variant="secondary" onPress={handleViewOnMap} style={styles.actionBtn}>
            View on Map
          </StyledButton>
        </View>

        {(checkpoints.length >= 2 || checkpoints.length > 0) && (
          <View style={styles.actionRow}>
            {checkpoints.length >= 2 && (
              <StyledButton variant="secondary" onPress={handleReverseRoute} style={styles.actionBtn}>
                Reverse
              </StyledButton>
            )}
            {checkpoints.length > 0 && (
              <StyledButton variant="secondary" onPress={handleClearPoints} style={styles.actionBtn}>
                Clear Points
              </StyledButton>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <StyledButton variant="secondary" onPress={() => handleEdit(item)} style={styles.actionBtn}>
            Edit Details
          </StyledButton>
          <StyledButton variant="secondary" onPress={() => deactivateRoute()} style={styles.actionBtn}>
            Deactivate
          </StyledButton>
          <StyledButton variant="secondary" onPress={() => handleRemove(item.id)} style={styles.actionBtn}>
            Delete
          </StyledButton>
        </View>
      </View>
    );
  }

  function renderInactiveContent(item: RouteItem) {
    const pointCount = item.checkpoints?.length ?? 0;

    return (
      <View>
        {pointCount > 0 && (
          <ThemedText style={styles.savedCount}>
            {pointCount} saved {pointCount === 1 ? 'point' : 'points'}
          </ThemedText>
        )}
        <View style={styles.actionRow}>
          <StyledButton variant="primary" onPress={() => activateRoute(item)} style={styles.actionBtn}>
            Load Route
          </StyledButton>
          <StyledButton variant="secondary" onPress={() => handleEdit(item)} style={styles.actionBtn}>
            Edit
          </StyledButton>
          <StyledButton variant="secondary" onPress={() => handleRemove(item.id)} style={styles.actionBtn}>
            Delete
          </StyledButton>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: safeBg }]}>
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Routes</ThemedText>
          <StyledButton variant="primary" onPress={() => { setEditingId(null); setEditingItem(null); setOpen(true); }}>
            New Route
          </StyledButton>
        </View>

        <View style={styles.stackContainer}>
          <FlatList
            data={routes}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={renderRouteCard}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No routes yet</ThemedText>
                <ThemedText style={styles.emptySubtitle}>Create a route to start adding waypoints</ThemedText>
                <StyledButton variant="primary" onPress={() => { setEditingId(null); setEditingItem(null); setOpen(true); }}>
                  Create your first route
                </StyledButton>
              </View>
            }
          />
        </View>

        {/* ── Modals ── */}
        <EditRouteModal
          visible={open}
          onClose={() => setOpen(false)}
          onSave={handleSaveRoute}
          initialTitle={editingItem?.title}
          initialSubtitle={editingItem?.subtitle}
          initialIcon={editingItem?.icon}
          initialColor={editingItem?.color}
          isEditing={!!editingId}
        />

        <AddRoutePanel
          visible={addPanelVisible}
          onClose={() => setAddPanelVisible(false)}
          onSelect={handleAddPanelSelect}
        />

        <GridReferenceModal
          visible={referenceModalVisible}
          onClose={() => setReferenceModalVisible(false)}
          onAdd={handleAddPoint}
        />

        <ProjectPointModal
          visible={projectModalVisible}
          onClose={() => setProjectModalVisible(false)}
          onAdd={handleAddPoint}
        />

        <SavedRoutesModal
          visible={savedRoutesModalVisible}
          onClose={() => setSavedRoutesModalVisible(false)}
          onSelectRoute={handleAddSavedRoute}
          onSelectLocation={handleAddSavedLocation}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stackContainer: { flex: 1, paddingTop: 5 },

  // Card
  card: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  cardLeft: { width: 48, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  routeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  routeColorDot: { width: 10, height: 10, borderRadius: 999 },
  cardSubline: { opacity: 0.6, fontSize: 13 },

  // Active badge
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Checkpoint list
  cpList: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cpIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cpIndexText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cpInfo: { flex: 1 },
  cpLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  cpCoords: {
    fontSize: 13,
    opacity: 0.6,
    fontVariant: ['tabular-nums'],
  },
  cpDeleteBtn: {
    padding: 4,
    opacity: 0.5,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  actionBtn: {
    minWidth: 90,
  },

  // Empty / hints
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { opacity: 0.5, textAlign: 'center', marginBottom: 4, fontSize: 16 },
  emptySubtitle: { opacity: 0.4, textAlign: 'center', marginBottom: 16, fontSize: 13 },
  emptyHint: { opacity: 0.5, textAlign: 'center', paddingVertical: 12 },
  savedCount: { opacity: 0.6, marginBottom: 12 },
});
