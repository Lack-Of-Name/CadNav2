import { AddRoutePanel } from '@/components/AddRoutePanel';
import { alert as showAlert } from '@/components/alert';
import { EditRouteModal } from '@/components/EditRouteModal';
import { GridReferenceModal } from '@/components/GridReferenceModal';
import { formatGridReference, latLonToGridCoords } from '@/components/map/mapGrid';
import { ProjectPointModal } from '@/components/ProjectPointModal';
import { DenseButton } from '@/components/routes/DenseButton';
import { RouteListItem } from '@/components/routes/RouteListItem';
import { SavedRoutesModal } from '@/components/SavedRoutesModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEFAULT_ROUTE_COLOR } from '@/constants/routeColors';
import { Colors } from '@/constants/theme';
import { isTempTargetColor, useCheckpoints } from '@/hooks/checkpoints';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWorkspaceRoutes } from '@/hooks/use-workspace-routes';
import { computeRouteDistanceMeters, formatDistance } from '@/lib/geo';
import type { Checkpoint, RouteItem, SavedLocation, SavedRoute } from '@/types';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatGrid(lat: number, lon: number, origin: { latitude: number; longitude: number } | null, conv: number): string {
  if (!origin) return '';
  const { easting, northing } = latLonToGridCoords(origin, { latitude: lat, longitude: lon }, conv);
  return ` · Grid: ${formatGridReference(easting, northing)}`;
}

export default function RoutesScreen() {
  const { mapGridOrigin, gridConvergence } = useSettings();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const {
    requestPlacementMode,
    addCheckpoint,
    checkpoints,
    removeCheckpoint,
    reorderCheckpoints,
    setActiveRouteColor,
    setCheckpointsColor,
    clearActiveRoute,
    selectedId,
    selectCheckpoint,
    selectedCheckpoint,
    setViewTarget,
    saveRoute: persistRoute,
    saveLocation: persistLocation,
    activeRouteLoop,
    setActiveRouteLoop,
    activeRouteColor,
    activeWorkspaceRouteId,
    setActiveWorkspaceRoute,
  } = useCheckpoints();

  const {
    routes,
    setRoutes,
    activeRouteId: persistedActiveRouteId,
    setActiveRouteId: persistActiveRouteId,
    isLoaded: routesLoaded,
    getBackupJson,
  } = useWorkspaceRoutes();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RouteItem | null>(null);
  const [addPanelVisible, setAddPanelVisible] = useState(false);
  const [referenceModalVisible, setReferenceModalVisible] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [savedRoutesModalVisible, setSavedRoutesModalVisible] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const activeRouteId = activeWorkspaceRouteId;

  const isSyncingRef = useRef(false);
  const hydratedActiveRouteRef = useRef(false);

  function activateRoute(routeItem: RouteItem) {
    syncCheckpointsToRoute();
    isSyncingRef.current = true;
    const cps = routeItem.checkpoints ?? [];
    void setActiveWorkspaceRoute(routeItem.id, routeItem.title);
    persistActiveRouteId(routeItem.id);
    setExpandedRouteId(routeItem.id);
    setActiveRouteColor(routeItem.color ?? null);
    setActiveRouteLoop(!!routeItem.isLoop);
    reorderCheckpoints(cps);
    if (routeItem.color) setCheckpointsColor(routeItem.color);
    setTimeout(() => { isSyncingRef.current = false; }, 150);
  }

  function deactivateRoute() {
    syncCheckpointsToRoute();
    isSyncingRef.current = true;
    void setActiveWorkspaceRoute(null, null);
    persistActiveRouteId(null);
    setActiveRouteColor(null);
    setActiveRouteLoop(false);
    clearActiveRoute();
    setTimeout(() => { isSyncingRef.current = false; }, 150);
  }

  useEffect(() => {
    if (!routesLoaded || hydratedActiveRouteRef.current || activeWorkspaceRouteId || !persistedActiveRouteId) return;
    const route = routes.find((r) => r.id === persistedActiveRouteId);
    if (!route) return;
    hydratedActiveRouteRef.current = true;
    activateRoute(route);
  }, [routesLoaded, persistedActiveRouteId, activeWorkspaceRouteId, routes]);

  function syncCheckpointsToRoute() {
    if (!activeRouteId) return;
    setRoutes((r) =>
      r.map((it) =>
        it.id === activeRouteId
          ? { ...it, checkpoints: [...checkpoints], isLoop: activeRouteLoop }
          : it,
      ),
    );
  }

  useEffect(() => {
    if (!activeRouteId || isSyncingRef.current || isTempTargetColor(activeRouteColor)) return;
    setRoutes((r) =>
      r.map((it) =>
        it.id === activeRouteId
          ? { ...it, checkpoints: [...checkpoints], isLoop: activeRouteLoop }
          : it,
      ),
    );
  }, [checkpoints, activeRouteId, activeRouteLoop, activeRouteColor]);

  function toggleExpanded(id: string) {
    setExpandedRouteId((prev) => (prev === id ? null : id));
  }

  function handleAddPanelSelect(option: string) {
    setAddPanelVisible(false);
    setTimeout(() => {
      if (option === 'place') {
        void requestPlacementMode('route');
        router.push('/');
      } else if (option === 'reference') {
        setReferenceModalVisible(true);
      } else if (option === 'project') {
        setProjectModalVisible(true);
      } else if (option === 'saved') {
        setSavedRoutesModalVisible(true);
      }
    }, 200);
  }

  function handleAddPoint(location: { latitude: number; longitude: number }) {
    addCheckpoint(location.latitude, location.longitude);
    setReferenceModalVisible(false);
    setProjectModalVisible(false);
    router.push('/');
  }

  function handleAddSavedRoute(route: SavedRoute) {
    route.checkpoints.forEach((cp) => {
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

  function handleOpenAddPoints(routeItem: RouteItem) {
    if (activeRouteId !== routeItem.id) activateRoute(routeItem);
    setAddPanelVisible(true);
  }

  function handleReverseRoute() {
    if (checkpoints.length < 2) return;
    if (activeRouteLoop) {
      const reversed = [checkpoints[0], ...[...checkpoints.slice(1)].reverse()];
      reorderCheckpoints(reversed);
    } else {
      reorderCheckpoints([...checkpoints].reverse());
    }
  }

  function handleRandomiseRoute() {
    if (checkpoints.length < 2) return;
    if (activeRouteLoop) {
      const shuffled = [...checkpoints.slice(1)];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      reorderCheckpoints([checkpoints[0], ...shuffled]);
    } else {
      const shuffled = [...checkpoints];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      reorderCheckpoints(shuffled);
    }
  }

  async function handleSaveRouteToLibrary(item: RouteItem) {
    if (checkpoints.length === 0) {
      void showAlert({ title: 'Save route', message: 'Add waypoints before saving to the library.' });
      return;
    }
    try {
      await persistRoute(item.title);
      void showAlert({
        title: 'Saved',
        message: `"${item.title}" is in your saved library (Add waypoint → Saved library).`,
      });
    } catch (err) {
      void showAlert({ title: 'Save failed', message: String(err) });
    }
  }

  async function handleShareRoute(item: RouteItem) {
    const isActive = item.id === activeRouteId;
    const cps = isActive ? checkpoints : (item.checkpoints || []);
    const loop = isActive ? activeRouteLoop : (item.isLoop || false);
    if (cps.length === 0) {
      void showAlert({ title: 'Share route', message: 'Add waypoints before sharing.' });
      return;
    }

    const lines = [`Route: ${item.title}`];
    if (item.subtitle) lines.push(item.subtitle);
    lines.push('');
    lines.push(`Total: ${formatDistance(computeRouteDistanceMeters(cps, loop))}`);
    lines.push('');

    cps.forEach((cp, idx) => {
      lines.push(`WP ${idx + 1}${cp.label ? ` — ${cp.label}` : ''}`);
      const gridRef = mapGridOrigin
        ? formatGridReference(
            ...Object.values(
              latLonToGridCoords(
                mapGridOrigin,
                { latitude: cp.latitude, longitude: cp.longitude },
                gridConvergence ?? 0,
              ),
            ) as [number, number],
          )
        : 'No grid origin';
      lines.push(`Grid: ${gridRef}`);
      const grid = formatGrid(cp.latitude, cp.longitude, mapGridOrigin, gridConvergence ?? 0);
      if (grid) lines.push(grid.trim());
      lines.push('');
    });

    try {
      await Share.share({
        message: lines.join('\n'),
        title: `CadNav — ${item.title}`,
      });
    } catch (error: unknown) {
      void showAlert({
        title: 'Share failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleExportBackup() {
    try {
      const raw = await getBackupJson();
      if (!raw) {
        void showAlert({ title: 'Export', message: 'No workspace routes to export.' });
        return;
      }
      await Share.share({ message: raw, title: 'CadNav workspace backup' });
    } catch (err: unknown) {
      void showAlert({
        title: 'Export failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSaveLocationFromCheckpoint(cp: Checkpoint) {
    const gridStr = mapGridOrigin
      ? formatGrid(cp.latitude, cp.longitude, mapGridOrigin, gridConvergence ?? 0).replace(' · Grid: ', '')
      : '';
    const name = cp.label || gridStr || `${cp.latitude.toFixed(4)}, ${cp.longitude.toFixed(4)}`;
    try {
      await persistLocation(name, cp.latitude, cp.longitude);
      void showAlert({
        title: 'Saved',
        message: 'Location added to saved library.',
      });
    } catch (err) {
      void showAlert({ title: 'Save failed', message: String(err) });
    }
  }

  function handleClearPoints() {
    if (checkpoints.length === 0) return;
    void showAlert({
      title: 'Clear waypoints?',
      message: `Remove all ${checkpoints.length} waypoints from this route?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearActiveRoute() },
      ],
    });
  }

  function handleViewOnMap() {
    if (selectedCheckpoint) {
      void setViewTarget({
        latitude: selectedCheckpoint.latitude,
        longitude: selectedCheckpoint.longitude,
        zoom: 14,
      });
    } else if (checkpoints.length > 0) {
      const avgLat = checkpoints.reduce((s, c) => s + c.latitude, 0) / checkpoints.length;
      const avgLon = checkpoints.reduce((s, c) => s + c.longitude, 0) / checkpoints.length;
      void setViewTarget({ latitude: avgLat, longitude: avgLon, zoom: 12 });
    }
    router.push('/');
  }

  function handleSaveRoute(title: string, subtitle: string, _icon: string, color: string) {
    if (editingId) {
      setRoutes((r) =>
        r.map((it) =>
          it.id === editingId
            ? { ...it, title, subtitle: subtitle || undefined, icon: undefined, color }
            : it,
        ),
      );
      if (editingId === activeRouteId) {
        setActiveRouteColor(color);
        setCheckpointsColor(color);
      }
    } else {
      const item: RouteItem = {
        id: String(Date.now()),
        title,
        subtitle: subtitle || undefined,
        color,
        checkpoints: [],
      };
      syncCheckpointsToRoute();
      setRoutes((r) => [item, ...r]);
      isSyncingRef.current = true;
      void setActiveWorkspaceRoute(item.id, title);
      persistActiveRouteId(item.id);
      setExpandedRouteId(item.id);
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
      message: 'Removes this route and all stored waypoints.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setRoutes((r) => r.filter((it) => it.id !== id));
            if (expandedRouteId === id) setExpandedRouteId(null);
            if (activeRouteId === id) {
              isSyncingRef.current = true;
              void setActiveWorkspaceRoute(null, null);
              persistActiveRouteId(null);
              setActiveRouteColor(null);
              clearActiveRoute();
              setTimeout(() => { isSyncingRef.current = false; }, 150);
            }
          },
        },
      ],
    });
  }

  function openNewRoute() {
    setEditingId(null);
    setEditingItem(null);
    setOpen(true);
  }

  const activeItem = routes.find((r) => r.id === activeRouteId);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ThemedView style={styles.container}>
        <View style={[styles.toolbar, { borderBottomColor: theme.divider }]}>
          <View style={styles.toolbarText}>
            <ThemedText style={styles.screenTitle}>Routes</ThemedText>
            <ThemedText style={[styles.screenMeta, { color: theme.textMuted }]}>
              {routes.length === 0
                ? 'Workspace empty'
                : `${routes.length} route${routes.length === 1 ? '' : 's'}${activeItem ? ` · ${activeItem.title}` : ''}`}
            </ThemedText>
          </View>
          <Pressable
            onPress={openNewRoute}
            style={({ pressed }) => [
              styles.newBtn,
              { borderColor: theme.divider, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityLabel="New route"
          >
            <IconSymbol name="plus" size={20} color={theme.text} />
          </Pressable>
        </View>

        <FlatList
          bounces={false}
          overScrollMode="never"
          data={routes}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[
            styles.listContent,
            routes.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.divider }} />}
          renderItem={({ item }) => (
            <RouteListItem
              item={item}
              colorScheme={colorScheme}
              expanded={expandedRouteId === item.id}
              isActive={activeRouteId === item.id}
              checkpoints={checkpoints}
              selectedId={selectedId}
              activeRouteLoop={activeRouteLoop}
              mapGridOrigin={mapGridOrigin}
              gridConvergence={gridConvergence}
              onToggleExpand={() => toggleExpanded(item.id)}
              onActivate={() => activateRoute(item)}
              onDeactivate={deactivateRoute}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleRemove(item.id)}
              onAddWaypoint={() => handleOpenAddPoints(item)}
              onViewMap={handleViewOnMap}
              onSelectCheckpoint={(id) => selectCheckpoint(id)}
              onRemoveCheckpoint={removeCheckpoint}
              onSaveCheckpointLocation={handleSaveLocationFromCheckpoint}
              onToggleLoop={() => setActiveRouteLoop(!activeRouteLoop)}
              onReverse={handleReverseRoute}
              onRandomise={handleRandomiseRoute}
              onSaveToLibrary={() => handleSaveRouteToLibrary(item)}
              onShare={() => handleShareRoute(item)}
              onClear={handleClearPoints}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No routes</ThemedText>
              <ThemedText style={[styles.emptyBody, { color: theme.textMuted }]}>
                Build a waypoint list for patrols, hikes, or exercises. Each route keeps its own points and distance.
              </ThemedText>
              <DenseButton
                label="New route"
                variant="primary"
                colorScheme={colorScheme}
                onPress={openNewRoute}
                style={styles.emptyCta}
              />
            </View>
          }
          ListFooterComponent={
            routes.length > 0 ? (
              <View style={styles.footer}>
                <DenseButton
                  label="Export workspace JSON"
                  variant="ghost"
                  colorScheme={colorScheme}
                  onPress={handleExportBackup}
                />
              </View>
            ) : null
          }
          style={[styles.list, { borderColor: theme.divider }]}
        />

        <EditRouteModal
          visible={open}
          onClose={() => setOpen(false)}
          onSave={handleSaveRoute}
          initialTitle={editingItem?.title}
          initialSubtitle={editingItem?.subtitle}
          initialColor={editingItem?.color ?? DEFAULT_ROUTE_COLOR}
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
  safe: { flex: 1 },
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarText: { flex: 1 },
  screenTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  screenMeta: {
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  newBtn: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
  },
  listContent: {
    paddingBottom: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  empty: {
    padding: 24,
    alignItems: 'flex-start',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  emptyCta: {
    alignSelf: 'stretch',
  },
  footer: {
    padding: 12,
    alignItems: 'center',
  },
});
