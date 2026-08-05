import { alert as showAlert } from '@/components/alert';
import { WORKSPACE_ROUTES } from '@/constants/storageKeys';
import type { WorkspaceRoute } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

type WorkspacePersisted = {
  routes: WorkspaceRoute[];
  activeRouteId: string | null;
};

type WorkspaceState = {
  routes: WorkspaceRoute[];
  activeRouteId: string | null;
  isLoaded: boolean;
};

function sanitizeRoutes(parsed: unknown): WorkspaceRoute[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.map((route) => {
    const r = route as WorkspaceRoute;
    return {
      ...r,
      checkpoints: (r.checkpoints ?? []).map((cp) => ({
        ...cp,
        latitude: Number(cp.latitude) || 0,
        longitude: Number(cp.longitude) || 0,
      })),
    };
  });
}

function parseWorkspaceStorage(raw: string | null): WorkspacePersisted {
  if (!raw) return { routes: [], activeRouteId: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { routes: sanitizeRoutes(parsed), activeRouteId: null };
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { routes?: unknown; activeRouteId?: unknown };
      return {
        routes: sanitizeRoutes(obj.routes),
        activeRouteId: typeof obj.activeRouteId === 'string' ? obj.activeRouteId : null,
      };
    }
  } catch {
    // fall through
  }
  return { routes: [], activeRouteId: null };
}

/**
 * Module-level singleton store for the Routes tab workspace.
 * Multiple components (Routes tab, map HUD) share one source of truth and one
 * serialized persistence path, so writes from one screen can never clobber
 * routes created on another.
 */
let state: WorkspaceState = { routes: [], activeRouteId: null, isLoaded: false };

const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function setState(next: WorkspaceState) {
  state = next;
  emitChange();
}

// Serialized write chain: guarantees ordered writes, last change wins.
let writeChain: Promise<void> = Promise.resolve();

function persistState(next: WorkspaceState) {
  const payload: WorkspacePersisted = { routes: next.routes, activeRouteId: next.activeRouteId };
  writeChain = writeChain.then(async () => {
    try {
      await AsyncStorage.setItem(WORKSPACE_ROUTES, JSON.stringify(payload));
    } catch (err) {
      void showAlert({ title: 'Routes save', message: String(err) });
    }
  });
}

let initPromise: Promise<void> | null = null;

function initStore() {
  if (state.isLoaded) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(WORKSPACE_ROUTES);
      if (raw) {
        const { routes: loaded, activeRouteId: loadedActive } = parseWorkspaceStorage(raw);
        setState({ routes: loaded, activeRouteId: loadedActive, isLoaded: true });
      } else {
        setState({ ...state, isLoaded: true });
      }
    } catch (err) {
      void showAlert({ title: 'Routes', message: String(err) });
      setState({ ...state, isLoaded: true });
    }
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

/**
 * Persists the Routes tab workspace (multiple route cards with metadata).
 * Separate from the saved-route library in `useCheckpoints` / SAVED_ROUTES.
 */
export function useWorkspaceRoutes() {
  const [snapshot, setSnapshot] = useState<WorkspaceState>(() => state);

  useEffect(() => {
    let mounted = true;
    const onChange = () => {
      if (!mounted) return;
      setSnapshot(state);
    };

    listeners.add(onChange);
    onChange();
    void initStore();

    return () => {
      mounted = false;
      listeners.delete(onChange);
    };
  }, []);

  const setRoutes = useCallback(
    (updater: WorkspaceRoute[] | ((prev: WorkspaceRoute[]) => WorkspaceRoute[])) => {
      const nextRoutes =
        typeof updater === 'function' ? updater(state.routes) : updater;
      const next: WorkspaceState = { ...state, routes: nextRoutes };
      setState(next);
      if (next.isLoaded) persistState(next);
    },
    [],
  );

  const setActiveRouteId = useCallback((id: string | null) => {
    const next: WorkspaceState = { ...state, activeRouteId: id };
    setState(next);
    if (next.isLoaded) persistState(next);
  }, []);

  const getBackupJson = useCallback(async (): Promise<string | null> => {
    return AsyncStorage.getItem(WORKSPACE_ROUTES);
  }, []);

  return {
    routes: snapshot.routes,
    setRoutes,
    activeRouteId: snapshot.activeRouteId,
    setActiveRouteId,
    isLoaded: snapshot.isLoaded,
    getBackupJson,
  };
}
