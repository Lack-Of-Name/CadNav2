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
import StyledButton from '@/components/ui/StyledButton';
import { Colors } from '@/constants/theme';
import { Checkpoint, SavedLocation, SavedRoute, useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type RouteItem = { id: string; title: string; subtitle?: string; icon?: string; color?: string };
const ROUTES_KEY = 'APP_ROUTES';

export default function RoutesScreen() {
  const router = useRouter();
  const {
    requestPlacementMode,
    selectedCheckpoint,
    addCheckpoint,
    checkpoints,
    reorderCheckpoints,
    setActiveRouteColor,
    setActiveRouteStart,
    setActiveRouteLoop,
    setCheckpointsColor,
  } = useCheckpoints();
  const { lastLocation, requestLocation } = useGPS();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RouteItem | null>(null);
  
  const [addPanelVisible, setAddPanelVisible] = useState(false);
  const [referenceModalVisible, setReferenceModalVisible] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [savedRoutesModalVisible, setSavedRoutesModalVisible] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [optimizeModalVisible, setOptimizeModalVisible] = useState(false);
  const [optimizeRouteItem, setOptimizeRouteItem] = useState<RouteItem | null>(null);
  const [optimizeIncludeCurrent, setOptimizeIncludeCurrent] = useState(false);
  const [optimizeMode, setOptimizeMode] = useState<'route' | 'circuit'>('route');

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
      // Add all checkpoints from the saved route
      // We do this sequentially to preserve order if addCheckpoint is async/state-dependent
      // Although addCheckpoint updates global store synchronously, it's safer to just loop.
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


  function handleSaveRoute(title: string, subtitle: string, icon: string, color: string) {
    if (editingId) {
      setRoutes((r) => r.map((it) => (it.id === editingId ? { ...it, title, subtitle: subtitle || undefined, icon: icon || undefined, color } : it)));
      if (editingId === activeRouteId) {
        setActiveRouteColor(color);
        setCheckpointsColor(color);
      }
    } else {
      const item: RouteItem = { id: String(Date.now()), title, subtitle: subtitle || undefined, icon: icon || undefined, color };
      setRoutes((r) => [item, ...r]);
    }
    setOpen(false);
    setEditingId(null);
    setEditingItem(null);
  }

  function handleOpenAddPoints(routeItem: RouteItem) {
    setActiveRouteId(routeItem.id);
    setActiveRouteColor(routeItem.color ?? null);
    setAddPanelVisible(true);
  }

  function handleOpenOptimize(routeItem: RouteItem) {
    setActiveRouteId(routeItem.id);
    setActiveRouteColor(routeItem.color ?? null);
    setOptimizeRouteItem(routeItem);
    setOptimizeIncludeCurrent(false);
    setOptimizeMode('route');
    setOptimizeModalVisible(true);
  }

  function computeNearestNeighborOrder(points: Checkpoint[], start: { latitude: number; longitude: number }) {
    const remaining = [...points];
    const ordered: Checkpoint[] = [];
    let current = start;

    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < remaining.length; i++) {
        const cp = remaining[i];
        const d = haversineMeters(current.latitude, current.longitude, cp.latitude, cp.longitude);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }

      const next = remaining.splice(bestIndex, 1)[0];
      ordered.push(next);
      current = { latitude: next.latitude, longitude: next.longitude };
    }

    return ordered;
  }

  function calculateTotalDistance(
    ordered: Checkpoint[],
    startPoint: { latitude: number; longitude: number },
    mode: 'route' | 'circuit'
  ) {
    if (ordered.length === 0) return 0;
    let dist = 0;
    let prev = startPoint;
    for (const cp of ordered) {
      dist += haversineMeters(prev.latitude, prev.longitude, cp.latitude, cp.longitude);
      prev = { latitude: cp.latitude, longitude: cp.longitude };
    }
    if (mode === 'circuit') {
      dist += haversineMeters(prev.latitude, prev.longitude, startPoint.latitude, startPoint.longitude);
    }
    return dist;
  }

  async function handleOptimizeRoute() {
    if (checkpoints.length < 2) {
      void showAlert({ title: 'Optimize route', message: 'Add at least two checkpoints first.' });
      return;
    }

    if (optimizeIncludeCurrent && !lastLocation) {
      requestLocation();
      void showAlert({ title: 'Optimize route', message: 'Current location unavailable. Try again once GPS is ready.' });
      return;
    }

    const startPoint = optimizeIncludeCurrent && lastLocation
      ? { latitude: lastLocation.coords.latitude, longitude: lastLocation.coords.longitude }
      : { latitude: checkpoints[0].latitude, longitude: checkpoints[0].longitude };

    await setActiveRouteStart(optimizeIncludeCurrent ? startPoint : null);
    await setActiveRouteLoop(optimizeMode === 'circuit');

    const ordered = computeNearestNeighborOrder(checkpoints, startPoint);
    await reorderCheckpoints(ordered);

    const distance = calculateTotalDistance(ordered, startPoint, optimizeMode);
    const distanceLabel = distance >= 1000 ? `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1)} km` : `${Math.round(distance)} m`;
    void showAlert({ title: 'Route optimized', message: `${optimizeMode === 'circuit' ? 'Circuit' : 'Route'} length: ${distanceLabel}` });

    setOptimizeModalVisible(false);
  }

  function handleEdit(item: RouteItem) {
    setEditingItem(item);
    setEditingId(item.id);
    setActiveRouteId(item.id);
    setActiveRouteColor(item.color ?? null);
    setOpen(true);
  }

  function handleRemove(id: string) {
    setRoutes((r) => r.filter((it) => it.id !== id));
    if (activeRouteId === id) {
      setActiveRouteId(null);
      setActiveRouteColor(null);
    }
  }

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

  const cardBg = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const safeBg = useThemeColor({}, 'background');


  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: safeBg }]}> 
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Routes</ThemedText>
          <StyledButton variant="primary" onPress={() => { setEditingId(null); setEditingItem(null); setOpen(true); }}>Add</StyledButton>
        </View>

        <View style={styles.stackContainer}>
          <FlatList
            data={routes}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: cardBg, marginBottom: 12, borderColor, borderWidth: 1, alignSelf: 'center', width: '98%' }]}> 
                <Collapsible
                  header={
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                      <View style={styles.cardLeft}>
                        <ThemedText style={{ fontSize: 28 }}>{item.icon ?? '📍'}</ThemedText>
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.routeTitleRow}>
                          <ThemedText lightColor={Colors.light.text} darkColor={Colors.dark.text} type="defaultSemiBold">{item.title}</ThemedText>
                          <View style={[styles.routeColorDot, { backgroundColor: item.color ?? Colors.light.tint }]} />
                        </View>
                        {item.subtitle ? <ThemedText lightColor={Colors.light.text} darkColor={Colors.dark.text} style={{ opacity: 0.7, fontSize: 13 }}>{item.subtitle}</ThemedText> : null}
                      </View>
                    </View>
                  }
                >
                  <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}>
                    <StyledButton
                      variant="primary"
                      onPress={() => handleOpenAddPoints(item)}
                      style={{ marginBottom: 8 }}
                    >
                      Add Point
                    </StyledButton>
                    <StyledButton
                      variant="secondary"
                      onPress={() => handleOpenOptimize(item)}
                      style={{ marginBottom: 8 }}
                    >
                      Optimize Route
                    </StyledButton>
                    <StyledButton variant="secondary" onPress={() => handleEdit(item)} style={{ marginBottom: 8 }}>Edit</StyledButton>
                    <StyledButton variant="secondary" onPress={() => handleRemove(item.id)} style={{ marginBottom: 8 }}>Remove</StyledButton>
                  </View>
                </Collapsible>
              </View>
            )}
            ListEmptyComponent={
                <View style={styles.emptyState}>
                    <ThemedText style={{ opacity: 0.5, textAlign: 'center', marginBottom: 8 }}>No routes yet</ThemedText>
                    <StyledButton variant="secondary" onPress={() => { setEditingId(null); setEditingItem(null); setOpen(true); }}>Create your first route</StyledButton>
                </View>
            }
          />
        </View>

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
          onClose={() => { setAddPanelVisible(false); }} 
          onSelect={handleAddPanelSelect} 
        />

        <GridReferenceModal 
            visible={referenceModalVisible} 
            onClose={() => { setReferenceModalVisible(false); }}
            onAdd={handleAddPoint}
        />

        <ProjectPointModal 
            visible={projectModalVisible} 
            onClose={() => { setProjectModalVisible(false); }}
            onAdd={handleAddPoint}
        />

        <SavedRoutesModal 
            visible={savedRoutesModalVisible} 
            onClose={() => { setSavedRoutesModalVisible(false); }}
            onSelectRoute={handleAddSavedRoute}
            onSelectLocation={handleAddSavedLocation}
        />

        <Modal visible={optimizeModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContainer, { backgroundColor: cardBg, borderColor, borderWidth: 1 }]}> 
              <ThemedText type="title">Optimize route</ThemedText>
              <ThemedText style={{ marginTop: 6, opacity: 0.7 }}>
                {optimizeRouteItem ? optimizeRouteItem.title : 'Current route'}
              </ThemedText>

              <View style={{ marginTop: 12 }}>
                <ThemedText type="defaultSemiBold">Mode</ThemedText>
                <View style={{ marginTop: 6 }}>
                  <TouchableOpacity onPress={() => setOptimizeMode('route')} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                    <View style={[styles.radioOuter, optimizeMode === 'route' && styles.radioOuterSelected]}>
                      {optimizeMode === 'route' ? <View style={styles.radioInner} /> : null}
                    </View>
                    <ThemedText style={{ marginLeft: 8 }}>Shortest route (open path)</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setOptimizeMode('circuit')} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                    <View style={[styles.radioOuter, optimizeMode === 'circuit' && styles.radioOuterSelected]}>
                      {optimizeMode === 'circuit' ? <View style={styles.radioInner} /> : null}
                    </View>
                    <ThemedText style={{ marginLeft: 8 }}>Shortest circuit (loop)</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.gridRow, { marginTop: 12 }]}> 
                <ThemedText type="defaultSemiBold">Include current location</ThemedText>
                <Switch value={optimizeIncludeCurrent} onValueChange={setOptimizeIncludeCurrent} />
              </View>

              <ThemedText style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Warning: this will reconfigure your route order.
              </ThemedText>

              <View style={styles.modalRow}>
                <StyledButton variant="secondary" onPress={() => setOptimizeModalVisible(false)}>{'Cancel'}</StyledButton>
                <View style={{ width: 12 }} />
                <StyledButton variant="primary" onPress={handleOptimizeRoute}>{'Optimize'}</StyledButton>
              </View>
            </View>
          </View>
        </Modal>

      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  gridRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stackContainer: { flex: 1, paddingTop: 5 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardLeft: { width: 48, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  routeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeColorDot: { width: 10, height: 10, borderRadius: 999, marginLeft: 6 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: 'white', padding: 16, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, marginTop: 8 },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#999', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: Colors.light.tint },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.tint },
  error: { color: 'red', marginTop: 8, marginBottom: 4 },
});
