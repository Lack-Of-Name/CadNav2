import { alert as showAlert } from '@/components/alert';
import { WORKSPACE_ROUTES } from '@/constants/storageKeys';
import type { WorkspaceRoute } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

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

/**
 * Persists the Routes tab workspace (multiple route cards with metadata).
 * Separate from the saved-route library in `useCheckpoints` / SAVED_ROUTES.
 */
export function useWorkspaceRoutes() {
  const [routes, setRoutes] = useState<WorkspaceRoute[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WORKSPACE_ROUTES);
        if (!cancelled && raw) {
          setRoutes(sanitizeRoutes(JSON.parse(raw)));
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
        await AsyncStorage.setItem(WORKSPACE_ROUTES, JSON.stringify(routes));
      } catch (err) {
        void showAlert({ title: 'Routes save', message: String(err) });
      }
    })();
  }, [routes, isLoaded]);

  const getBackupJson = useCallback(async (): Promise<string | null> => {
    return AsyncStorage.getItem(WORKSPACE_ROUTES);
  }, []);

  return { routes, setRoutes, isLoaded, getBackupJson };
}
