import { alert as showAlert } from '@/components/alert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_ROUTE_COLOR } from '@/constants/routeColors';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useWorkspaceRoutes } from '@/hooks/use-workspace-routes';
import { parseCadNavImportParams, type CadNavImportPayload } from '@/lib/importPayload';
import type { Checkpoint, WorkspaceRoute } from '@/types';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type ImportContext = {
  checkpoints: Checkpoint[];
  activeWorkspaceRouteId: string | null;
  routes: WorkspaceRoute[];
  addCheckpoint: ReturnType<typeof useCheckpoints>['addCheckpoint'];
  setCheckpointLabel: ReturnType<typeof useCheckpoints>['setCheckpointLabel'];
  setActiveWorkspaceRoute: ReturnType<typeof useCheckpoints>['setActiveWorkspaceRoute'];
  setActiveRouteColor: ReturnType<typeof useCheckpoints>['setActiveRouteColor'];
  setActiveRouteLoop: ReturnType<typeof useCheckpoints>['setActiveRouteLoop'];
  reorderCheckpoints: ReturnType<typeof useCheckpoints>['reorderCheckpoints'];
  setRoutes: ReturnType<typeof useWorkspaceRoutes>['setRoutes'];
  persistActiveRouteId: ReturnType<typeof useWorkspaceRoutes>['setActiveRouteId'];
};

async function applyImport(payload: CadNavImportPayload, ctx: ImportContext): Promise<void> {
  if (payload.kind === 'cp') {
    const { latitude, longitude, mgrs, label } = payload;
    const activeRoute = ctx.activeWorkspaceRouteId
      ? ctx.routes.find((r) => r.id === ctx.activeWorkspaceRouteId)
      : null;

    if (activeRoute) {
      const cp = await ctx.addCheckpoint(latitude, longitude, mgrs);
      if (label) await ctx.setCheckpointLabel(cp.id, label);
      ctx.setRoutes((rs) =>
        rs.map((it) =>
          it.id === activeRoute.id
            ? { ...it, checkpoints: [...(it.checkpoints ?? []), { ...cp, label: label || undefined }] }
            : it,
        ),
      );
      void showAlert({ title: 'Checkpoint imported', message: `Added to "${activeRoute.title}".` });
      return;
    }

    if (ctx.checkpoints.length === 0) {
      const cp: Checkpoint = {
        id: makeId(),
        latitude,
        longitude,
        createdAt: Date.now(),
        label: label || undefined,
        mgrs,
      };
      const color = DEFAULT_ROUTE_COLOR;
      const newRoute: WorkspaceRoute = {
        id: String(Date.now()),
        title: 'Imported checkpoint',
        color,
        checkpoints: [cp],
      };
      ctx.setRoutes((rs) => [newRoute, ...rs]);
      ctx.persistActiveRouteId(newRoute.id);
      await ctx.setActiveWorkspaceRoute(newRoute.id, newRoute.title);
      ctx.setActiveRouteColor(color);
      ctx.setActiveRouteLoop(false);
      ctx.reorderCheckpoints([{ ...cp, color }]);
      void showAlert({ title: 'Checkpoint imported', message: 'Added to a new route.' });
      return;
    }

    const cp = await ctx.addCheckpoint(latitude, longitude, mgrs);
    if (label) await ctx.setCheckpointLabel(cp.id, label);
    void showAlert({ title: 'Checkpoint imported', message: 'Point added to your current targets.' });
    return;
  }

  const cps: Checkpoint[] = payload.checkpoints.map((p) => ({
    id: makeId(),
    latitude: p.latitude,
    longitude: p.longitude,
    createdAt: Date.now(),
    label: p.label || undefined,
    mgrs: p.mgrs || undefined,
  }));
  const color = DEFAULT_ROUTE_COLOR;
  const newRoute: WorkspaceRoute = {
    id: String(Date.now()),
    title: payload.title,
    subtitle: payload.subtitle,
    color,
    checkpoints: cps,
    isLoop: payload.loop ? true : undefined,
  };
  ctx.setRoutes((rs) => [newRoute, ...rs]);
  ctx.persistActiveRouteId(newRoute.id);
  await ctx.setActiveWorkspaceRoute(newRoute.id, payload.title);
  ctx.setActiveRouteColor(color);
  ctx.setActiveRouteLoop(payload.loop);
  ctx.reorderCheckpoints(cps.map((cp) => ({ ...cp, color })));
  void showAlert({
    title: 'Route imported',
    message: `"${payload.title}" was added with ${cps.length} waypoint${cps.length === 1 ? '' : 's'}.`,
  });
}

/**
 * Handles `cadnav://import?…` deep links (from scanned QR codes).
 * Parses the payload, adds the checkpoint/route, then bounces to the map.
 */
export default function ImportScreen() {
  const rawParams = useLocalSearchParams();
  const router = useRouter();
  const {
    isLoaded: checkpointsLoaded,
    checkpoints,
    activeWorkspaceRouteId,
    addCheckpoint,
    setCheckpointLabel,
    setActiveWorkspaceRoute,
    setActiveRouteColor,
    setActiveRouteLoop,
    reorderCheckpoints,
  } = useCheckpoints();
  const {
    routes,
    setRoutes,
    setActiveRouteId: persistActiveRouteId,
    isLoaded: routesLoaded,
  } = useWorkspaceRoutes();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!checkpointsLoaded || !routesLoaded || handled) return;
    const payload = parseCadNavImportParams(rawParams as Record<string, string | string[] | undefined>);
    if (!payload) {
      setHandled(true);
      void showAlert({
        title: 'Import failed',
        message: 'That link is not a valid CadNav import.',
      });
      router.replace('/');
      return;
    }

    setHandled(true);
    void (async () => {
      try {
        await applyImport(payload, {
          checkpoints,
          activeWorkspaceRouteId,
          routes,
          addCheckpoint,
          setCheckpointLabel,
          setActiveWorkspaceRoute,
          setActiveRouteColor,
          setActiveRouteLoop,
          reorderCheckpoints,
          setRoutes,
          persistActiveRouteId,
        });
        router.replace('/');
      } catch (err) {
        void showAlert({
          title: 'Import failed',
          message: err instanceof Error ? err.message : String(err),
        });
        router.replace('/');
      }
    })();
  }, [checkpointsLoaded, routesLoaded, handled, rawParams, router, checkpoints, activeWorkspaceRouteId,
    routes, addCheckpoint, setCheckpointLabel, setActiveWorkspaceRoute, setActiveRouteColor,
    setActiveRouteLoop, reorderCheckpoints, setRoutes, persistActiveRouteId]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" />
      <ThemedText style={styles.text}>Importing…</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 14,
    opacity: 0.7,
  },
});