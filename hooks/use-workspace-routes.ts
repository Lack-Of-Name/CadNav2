import { alert as showAlert } from '@/components/alert';
import { WORKSPACE_ROUTES } from '@/constants/storageKeys';
import type { WorkspaceRoute } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

type WorkspacePersisted = {
  routes: WorkspaceRoute[];
  activeRouteId: string | null;
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
 * Persists the Routes tab workspace (multiple route cards with metadata).
 * Separate from the saved-route library in `useCheckpoints` / SAVED_ROUTES.
 */
export function useWorkspaceRoutes() {
  const [routes, setRoutes] = useState<WorkspaceRoute[]>([]);
  const [activeRouteId, setActiveRouteIdState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WORKSPACE_ROUTES);
        if (!cancelled && raw) {
          const { routes: loaded, activeRouteId: loadedActive } = parseWorkspaceStorage(raw);
          setRoutes(loaded);
          setActiveRouteIdState(loadedActive);
        }
      } catch (err) {
        void showAlert({ title: 'Routes', message: String(err) });
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const payload: WorkspacePersisted = { routes, activeRouteId };
        await AsyncStorage.setItem(WORKSPACE_ROUTES, JSON.stringify(payload));
      } catch (err) {
        void showAlert({ title: 'Routes save', message: String(err) });
      }
    })();
  }, [routes, activeRouteId, isLoaded]);

  const setActiveRouteId = useCallback((id: string | null) => {
    setActiveRouteIdState(id);
  }, []);

  const getBackupJson = useCallback(async (): Promise<string | null> => {
    return AsyncStorage.getItem(WORKSPACE_ROUTES);
  }, []);

  return { routes, setRoutes, activeRouteId, setActiveRouteId, isLoaded, getBackupJson };
}
