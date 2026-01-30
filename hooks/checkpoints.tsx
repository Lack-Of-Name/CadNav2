import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type Checkpoint = {
  id: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  label?: string;
  color?: string;
};

export type SavedRoute = {
  id: string;
  name: string;
  createdAt: number;
  checkpoints: Checkpoint[];
};

export type SavedLocation = {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  createdAt: number;
};

type PersistedRoutes = {
  routes: SavedRoute[];
};

type PersistedLocations = {
  locations: SavedLocation[];
};

const ROUTES_KEY = 'cadnav2.routes.v1';
const LOCATIONS_KEY = 'cadnav2.locations.v1';
const LEGACY_CHECKPOINTS_KEY = 'cadnav2.checkpoints.v1';

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
};

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
      placementModeRequested: false 
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
    (v.label === undefined || typeof v.label === 'string')
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
  const [snapshot, setSnapshot] = useState<StoreState>(() => getSnapshot());

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

  const requestPlacementMode = useCallback(async () => {
    setStore({ ...store, placementModeRequested: true });
  }, []);

  const consumePlacementModeRequest = useCallback(async () => {
    if (!store.placementModeRequested) return false;
    setStore({ ...store, placementModeRequested: false });
    return true;
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
      // Keep checkpoints in placement order.
      const nextCheckpoints = [...store.checkpoints, cp];
      setStore({ ...store, checkpoints: nextCheckpoints, selectedId: cp.id });
      return cp;
    },
    []
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

    const route: SavedRoute = {
      id: makeId(),
      name: trimmed,
      createdAt: Date.now(),
      checkpoints: store.checkpoints,
    };

    const nextRoutes = [route, ...store.savedRoutes];
    const nextPersisted: PersistedRoutes = { routes: nextRoutes };
    setStore({ ...store, savedRoutes: nextRoutes });
    await persistRoutes(nextPersisted);
    return route;
  }, []);

  const loadRoute = useCallback(async (routeId: string) => {
    const route = store.savedRoutes.find((r) => r.id === routeId);
    if (!route) throw new Error('Route not found');
    const nextSelectedId = route.checkpoints.length > 0 ? route.checkpoints[route.checkpoints.length - 1].id : null;
    setStore({ ...store, checkpoints: route.checkpoints, selectedId: nextSelectedId });
    return route;
  }, []);

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
    addCheckpoint,
    removeCheckpoint,
    selectCheckpoint,
    setCheckpointLabel,
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
    consumePlacementModeRequest,
  } as const;
}
