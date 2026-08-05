import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import {
  LEGACY_CHECKPOINTS,
  SAVED_LOCATIONS,
  SAVED_ROUTES,
} from '@/constants/storageKeys';
import { Colors } from '@/constants/theme';
import type { Checkpoint, SavedLocation, SavedRoute } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type { Checkpoint, SavedLocation, SavedRoute } from '@/types';

type PersistedRoutes = {
  routes: SavedRoute[];
};

type PersistedLocations = {
  locations: SavedLocation[];
};

const ROUTES_KEY = SAVED_ROUTES;
const LOCATIONS_KEY = SAVED_LOCATIONS;
const LEGACY_CHECKPOINTS_KEY = LEGACY_CHECKPOINTS;

type StashedRouteState = {
  checkpoints: Checkpoint[];
  selectedId: string | null;
  activeRouteColor: string | null;
  activeRouteStart: { latitude: number; longitude: number } | null;
  activeRouteLoop: boolean;
};

type StoreState = {
  checkpoints: Checkpoint[];
  selectedId: string | null;
  savedRoutes: SavedRoute[];
  savedLocations: SavedLocation[];
  isLoaded: boolean;
  placementModeRequested: boolean;
  activeRouteColor: string | null;
  activeRouteStart: { latitude: number; longitude: number } | null;
  activeRouteLoop: boolean;
  viewTarget: { latitude: number; longitude: number; zoom?: number } | null;
  activeWorkspaceRouteId: string | null;
  activeWorkspaceRouteTitle: string | null;
  tempNavigationActive: boolean;
  stashedRouteState: StashedRouteState | null;
};

let store: StoreState = {
  checkpoints: [],
  selectedId: null,
  savedRoutes: [],
  savedLocations: [],
  isLoaded: false,
  placementModeRequested: false,
  activeRouteColor: null,
  activeRouteStart: null,
  activeRouteLoop: false,
  viewTarget: null,
  activeWorkspaceRouteId: null,
  activeWorkspaceRouteTitle: null,
  tempNavigationActive: false,
  stashedRouteState: null,
};

export function isTempTargetColor(color: string | null | undefined): boolean {
  if (!color) return false;
  return color === Colors.light.tempTarget || color === Colors.dark.tempTarget;
}

const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function getSnapshot(): StoreState {
  return store;
}

function setStore(next: StoreState) {
  store = next;
  emitChange();
}

async function persistRoutes(next: PersistedRoutes) {
  await AsyncStorage.setItem(ROUTES_KEY, JSON.stringify(next));
}

async function persistLocations(next: PersistedLocations) {
  await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(next));
}

let initPromise: Promise<void> | null = null;
async function initStore() {
  if (store.isLoaded) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Load saved routes (active route is ephemeral unless explicitly saved).
    const rawRoutes = await AsyncStorage.getItem(ROUTES_KEY);
    const rawLocations = await AsyncStorage.getItem(LOCATIONS_KEY);

    let parsedRoutes: unknown = null;
    try {
      parsedRoutes = rawRoutes ? (JSON.parse(rawRoutes) as unknown) : null;
    } catch {
      parsedRoutes = null;
    }

    let parsedLocations: unknown = null;
    try {
      parsedLocations = rawLocations ? (JSON.parse(rawLocations) as unknown) : null;
    } catch {
      parsedLocations = null;
    }

    const hydratedRoutes = normalizePersistedRoutes(parsedRoutes);
    const hydratedLocations = normalizePersistedLocations(parsedLocations);

    // One-time migration: previous versions persisted active checkpoints under LEGACY_CHECKPOINTS_KEY.
    // We now only persist saved routes, so we import legacy checkpoints as a saved route once.
    if (hydratedRoutes.routes.length === 0) {
      const legacyRaw = await AsyncStorage.getItem(LEGACY_CHECKPOINTS_KEY);
      if (legacyRaw) {
        let legacyParsed: unknown = null;
        try {
          legacyParsed = JSON.parse(legacyRaw) as unknown;
        } catch {
          legacyParsed = null;
        }

        const legacy = normalizeLegacyCheckpoints(legacyParsed);
        if (legacy.checkpoints.length > 0) {
          const imported: SavedRoute = {
            id: makeId(),
            name: 'Recovered route',
            createdAt: Date.now(),
            checkpoints: legacy.checkpoints,
          };
          hydratedRoutes.routes = [imported, ...hydratedRoutes.routes];
          await persistRoutes(hydratedRoutes);
        }

        // Avoid repeatedly re-importing.
        await AsyncStorage.removeItem(LEGACY_CHECKPOINTS_KEY);
      }
    }

    setStore({ 
      checkpoints: [], 
      selectedId: null, 
      savedRoutes: hydratedRoutes.routes, 
      savedLocations: hydratedLocations.locations,
      isLoaded: true, 
      placementModeRequested: false,
      activeRouteColor: null,
      activeRouteStart: null,
      activeRouteLoop: false,
      viewTarget: null,
      activeWorkspaceRouteId: null,
      activeWorkspaceRouteTitle: null,
      tempNavigationActive: false,
      stashedRouteState: null,
    });

    // Ensure storage is initialized with normalized shape.
    await persistRoutes(hydratedRoutes);
    await persistLocations(hydratedLocations);
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

function isCheckpoint(value: unknown): value is Checkpoint {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return (
    typeof v.id === 'string' &&
    typeof v.latitude === 'number' &&
    typeof v.longitude === 'number' &&
    typeof v.createdAt === 'number' &&
    (v.label === undefined || typeof v.label === 'string') &&
    (v.color === undefined || typeof v.color === 'string') &&
    (v.elevation === undefined || typeof v.elevation === 'number')
  );
}

function isSavedRoute(value: unknown): value is SavedRoute {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'number' &&
    Array.isArray(v.checkpoints) &&
    v.checkpoints.every(isCheckpoint)
  );
}

function isSavedLocation(value: unknown): value is SavedLocation {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    (v.description === undefined || typeof v.description === 'string') &&
    typeof v.latitude === 'number' &&
    typeof v.longitude === 'number' &&
    typeof v.createdAt === 'number'
  );
}

function normalizePersistedRoutes(raw: unknown): PersistedRoutes {
  if (!raw || typeof raw !== 'object') {
    return { routes: [] };
  }

  const r = raw as any;
  const routes = Array.isArray(r.routes) ? r.routes.filter(isSavedRoute) : [];
  return { routes };
}

function normalizePersistedLocations(raw: unknown): PersistedLocations {
  if (!raw || typeof raw !== 'object') {
    return { locations: [] };
  }

  const r = raw as any;
  const locations = Array.isArray(r.locations) ? r.locations.filter(isSavedLocation) : [];
  return { locations };
}

function normalizeLegacyCheckpoints(raw: unknown): { checkpoints: Checkpoint[] } {
  if (!raw || typeof raw !== 'object') {
    return { checkpoints: [] };
  }

  const r = raw as any;
  const cps = Array.isArray(r.checkpoints) ? r.checkpoints.filter(isCheckpoint) : [];
  // legacy ordering was newest-first; reverse to placement order (oldest-first)
  return { checkpoints: [...cps].reverse() };
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useCheckpoints() {
  const { apiKey } = useMapTilerKey();
  const [snapshot, setSnapshot] = useState<StoreState>(() => getSnapshot());

  const enrichCheckpoints = useCallback(async (checkpoints: Checkpoint[]) => {
    if (!apiKey) return checkpoints;
    const needFetch = checkpoints.some(c => c.elevation === undefined);
    if (!needFetch) return checkpoints;

    let didEnrich = false;
    const enriched = [...checkpoints];
    await Promise.all(
      enriched.map(async (cp, i) => {
        if (cp.elevation === undefined) {
          try {
            const res = await fetch(`https://api.maptiler.com/elevation/at?lon=${cp.longitude}&lat=${cp.latitude}&key=${apiKey}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.length > 0 && typeof data[0] === 'number') {
                enriched[i] = { ...cp, elevation: data[0] };
                didEnrich = true;
              }
            }
          } catch (err) {
            console.warn('Failed to bulk fetch elevation for checkpoint', err);
          }
        }
      })
    );
    return didEnrich ? enriched : checkpoints;
  }, [apiKey]);

  useEffect(() => {
    let mounted = true;
    const onChange = () => {
      if (!mounted) return;
      setSnapshot(getSnapshot());
    };

    listeners.add(onChange);
    onChange();
    void initStore();

    return () => {
      mounted = false;
      listeners.delete(onChange);
    };
  }, []);

  const selectCheckpoint = useCallback(
    async (id: string | null) => {
      setStore({ ...store, selectedId: id });
    },
    []
  );

  const stashActiveRouteForTemp = useCallback(() => {
    if (!store.activeWorkspaceRouteId || store.checkpoints.length === 0) return null;
    return {
      checkpoints: [...store.checkpoints],
      selectedId: store.selectedId,
      activeRouteColor: store.activeRouteColor,
      activeRouteStart: store.activeRouteStart,
      activeRouteLoop: store.activeRouteLoop,
    } satisfies StashedRouteState;
  }, []);

  const requestPlacementMode = useCallback(async () => {
    // Behavior is decided at placement time: with an active route the point is
    // appended to it; otherwise it becomes a temp navigation target.
    setStore({ ...store, placementModeRequested: true });
  }, []);

  const beginTempNavigation = useCallback(async () => {
    const stash = stashActiveRouteForTemp();
    setStore({
      ...store,
      tempNavigationActive: true,
      stashedRouteState: stash ?? store.stashedRouteState,
      checkpoints: [],
      selectedId: null,
      activeRouteColor: Colors.light.tempTarget,
      activeRouteStart: null,
      activeRouteLoop: false,
    });
  }, [stashActiveRouteForTemp]);

  const resumeStashedRoute = useCallback(async () => {
    const stash = store.stashedRouteState;
    if (!stash) return false;
    setStore({
      ...store,
      checkpoints: stash.checkpoints,
      selectedId: stash.selectedId,
      activeRouteColor: stash.activeRouteColor,
      activeRouteStart: stash.activeRouteStart,
      activeRouteLoop: stash.activeRouteLoop,
      tempNavigationActive: false,
      stashedRouteState: null,
      placementModeRequested: false,
    });
    return true;
  }, []);

  const setActiveWorkspaceRoute = useCallback(async (id: string | null, title: string | null) => {
    setStore({
      ...store,
      activeWorkspaceRouteId: id,
      activeWorkspaceRouteTitle: title,
      tempNavigationActive: false,
      stashedRouteState: null,
    });
  }, []);

  const cancelPlacementMode = useCallback(async () => {
    setStore({ ...store, placementModeRequested: false });
  }, []);

  const setViewTarget = useCallback(async (target: { latitude: number; longitude: number; zoom?: number } | null) => {
    setStore({ ...store, viewTarget: target });
  }, []);

  const consumeViewTarget = useCallback(async () => {
    const target = store.viewTarget;
    if (!target) return null;
    setStore({ ...store, viewTarget: null });
    return target;
  }, []);

  const addCheckpoint = useCallback(
    async (latitude: number, longitude: number) => {
      const cp: Checkpoint = {
        id: makeId(),
        latitude,
        longitude,
        createdAt: Date.now(),
        color: store.activeRouteColor ?? undefined,
      };
      // Keep checkpoints in placement order. Render immediately — do not block
      // the tap on the elevation network request.
      const nextCheckpoints = [...store.checkpoints, cp];
      setStore({ ...store, checkpoints: nextCheckpoints, selectedId: cp.id });

      if (apiKey) {
        fetch(`https://api.maptiler.com/elevation/at?lon=${longitude}&lat=${latitude}&key=${apiKey}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.length > 0 && typeof data[0] === 'number') {
              const enriched = store.checkpoints.map((c) =>
                c.id === cp.id ? { ...c, elevation: data[0] } : c
              );
              setStore({ ...store, checkpoints: enriched });
            }
          })
          .catch((err) => {
            console.warn('Failed to fetch elevation for checkpoint', err);
          });
      }

      return cp;
    },
    [apiKey]
  );

  const removeCheckpoint = useCallback(async (id: string) => {
    const nextCheckpoints = store.checkpoints.filter((c) => c.id !== id);
    const nextSelectedId =
      store.selectedId === id
        ? nextCheckpoints.length > 0
          ? nextCheckpoints[nextCheckpoints.length - 1].id
          : null
        : store.selectedId;
    setStore({ ...store, checkpoints: nextCheckpoints, selectedId: nextSelectedId });
  }, []);

  const setCheckpointLabel = useCallback(async (id: string, label: string) => {
    const normalized = label.trim();
    const nextCheckpoints = store.checkpoints.map((c) => {
      if (c.id !== id) return c;
      if (normalized.length === 0) {
        const { label: _label, ...rest } = c;
        return rest;
      }
      return { ...c, label: normalized };
    });
    setStore({ ...store, checkpoints: nextCheckpoints });
  }, []);

  const setCheckpointsColor = useCallback(async (color: string | null) => {
    const nextCheckpoints = store.checkpoints.map((c) => ({
      ...c,
      color: color ?? undefined,
    }));
    setStore({ ...store, checkpoints: nextCheckpoints });
  }, []);

  const reorderCheckpoints = useCallback(async (nextCheckpoints: Checkpoint[]) => {
    const hasSelected = store.selectedId && nextCheckpoints.some((c) => c.id === store.selectedId);
    const nextSelectedId = hasSelected
      ? store.selectedId
      : nextCheckpoints.length > 0
        ? nextCheckpoints[nextCheckpoints.length - 1].id
        : null;
    setStore({ ...store, checkpoints: nextCheckpoints, selectedId: nextSelectedId });
  }, []);

  const setActiveRouteColor = useCallback(async (color: string | null) => {
    setStore({ ...store, activeRouteColor: color });
  }, []);

  const setActiveRouteStart = useCallback(async (start: { latitude: number; longitude: number } | null) => {
    setStore({ ...store, activeRouteStart: start });
  }, []);

  const setActiveRouteLoop = useCallback(async (loop: boolean) => {
    setStore({ ...store, activeRouteLoop: loop });
  }, []);

  const clearActiveRoute = useCallback(async () => {
    setStore({ ...store, checkpoints: [], selectedId: null });
  }, []);

  const saveLocation = useCallback(async (name: string, latitude: number, longitude: number, description?: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error('Location name is required');

    const location: SavedLocation = {
      id: makeId(),
      name: trimmed,
      description: description?.trim(),
      latitude,
      longitude,
      createdAt: Date.now(),
    };

    const nextLocations = [location, ...store.savedLocations];
    const nextPersisted: PersistedLocations = { locations: nextLocations };
    setStore({ ...store, savedLocations: nextLocations });
    await persistLocations(nextPersisted);
    return location;
  }, []);

  const deleteLocation = useCallback(async (locationId: string) => {
    const nextLocations = store.savedLocations.filter((l) => l.id !== locationId);
    const nextPersisted: PersistedLocations = { locations: nextLocations };
    setStore({ ...store, savedLocations: nextLocations });
    await persistLocations(nextPersisted);
  }, []);

  const saveRoute = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error('Route name is required');
    if (store.checkpoints.length === 0) throw new Error('No checkpoints to save');

    const checkpointsToSave = await enrichCheckpoints(store.checkpoints);

    const route: SavedRoute = {
      id: makeId(),
      name: trimmed,
      createdAt: Date.now(),
      checkpoints: checkpointsToSave,
      isLoop: store.activeRouteLoop,
    };

    const nextRoutes = [route, ...store.savedRoutes];
    const nextPersisted: PersistedRoutes = { routes: nextRoutes };
    setStore({ ...store, savedRoutes: nextRoutes, checkpoints: checkpointsToSave });
    await persistRoutes(nextPersisted);
    return route;
  }, [enrichCheckpoints]);

  const loadRoute = useCallback(async (routeId: string) => {
    const routeIndex = store.savedRoutes.findIndex((r) => r.id === routeId);
    if (routeIndex === -1) throw new Error('Route not found');
    
    const route = store.savedRoutes[routeIndex];
    const enrichedCheckpoints = await enrichCheckpoints(route.checkpoints);
    const didUpdate = enrichedCheckpoints !== route.checkpoints;

    const nextSelectedId = enrichedCheckpoints.length > 0 ? enrichedCheckpoints[enrichedCheckpoints.length - 1].id : null;
    
    if (didUpdate) {
      const updatedRoute = { ...route, checkpoints: enrichedCheckpoints };
      const nextRoutes = [...store.savedRoutes];
      nextRoutes[routeIndex] = updatedRoute;
      const nextPersisted: PersistedRoutes = { routes: nextRoutes };
      
      setStore({ ...store, savedRoutes: nextRoutes, checkpoints: enrichedCheckpoints, selectedId: nextSelectedId, activeRouteLoop: !!route.isLoop });
      await persistRoutes(nextPersisted);
      return updatedRoute;
    } else {
      setStore({ ...store, checkpoints: route.checkpoints, selectedId: nextSelectedId, activeRouteLoop: !!route.isLoop });
      return route;
    }
  }, [enrichCheckpoints]);

  const deleteRoute = useCallback(async (routeId: string) => {
    const nextRoutes = store.savedRoutes.filter((r) => r.id !== routeId);
    const nextPersisted: PersistedRoutes = { routes: nextRoutes };
    setStore({ ...store, savedRoutes: nextRoutes });
    await persistRoutes(nextPersisted);
  }, []);

  const selectedCheckpoint = useMemo(() => {
    if (!snapshot.selectedId) return null;
    return snapshot.checkpoints.find((c: Checkpoint) => c.id === snapshot.selectedId) ?? null;
  }, [snapshot.checkpoints, snapshot.selectedId]);

  return {
    checkpoints: snapshot.checkpoints,
    selectedId: snapshot.selectedId,
    selectedCheckpoint,
    savedRoutes: snapshot.savedRoutes,
    savedLocations: snapshot.savedLocations,
    isLoaded: snapshot.isLoaded,
    placementModeRequested: snapshot.placementModeRequested,
    activeRouteColor: snapshot.activeRouteColor,
    activeRouteStart: snapshot.activeRouteStart,
    activeRouteLoop: snapshot.activeRouteLoop,
    viewTarget: snapshot.viewTarget,
    activeWorkspaceRouteId: snapshot.activeWorkspaceRouteId,
    activeWorkspaceRouteTitle: snapshot.activeWorkspaceRouteTitle,
    tempNavigationActive: snapshot.tempNavigationActive,
    stashedRouteState: snapshot.stashedRouteState,
    addCheckpoint,
    removeCheckpoint,
    selectCheckpoint,
    setCheckpointLabel,
    setCheckpointsColor,
    reorderCheckpoints,
    setActiveRouteColor,
    setActiveRouteStart,
    setActiveRouteLoop,
    clearActiveRoute,
    saveRoute,
    loadRoute,
    deleteRoute,
    saveLocation,
    deleteLocation,
    requestPlacementMode,
    beginTempNavigation,
    resumeStashedRoute,
    setActiveWorkspaceRoute,
    cancelPlacementMode,
    setViewTarget,
    consumeViewTarget,
  } as const;
}
