import React, {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import type { LatLng } from '../utils/geo';
import type { GridAnchor, GridConfig } from '../utils/grid';
import { type LatLonBounds } from '../utils/offlineTiles';
import { buildOfflineDownloadPlan } from '../utils/offlineDownloadPlan';
import { offlineTileDownloader } from '../utils/offlineTileDownloader.native';

export type Checkpoint = {
  id: string;
  name: string;
  coordinate: LatLng;
  createdAt: number;
};

export type MapController = {
  centerOn: (coordinate: LatLng, options?: { animated?: boolean; zoom?: number }) => void;
  getCenter: () => LatLng | null;
};

type LocationState = {
  coordinate: LatLng | null;
  accuracyMeters?: number | null;
  updatedAt?: number | null;
  headingDeg?: number | null;
};

export type MapDownloadSelection = {
  active: boolean;
  firstCorner: LatLng | null;
  secondCorner: LatLng | null;
  // Stored when user hits Save (for later download implementation).
  lastSavedBounds?: { latMin: number; latMax: number; lonMin: number; lonMax: number } | null;
};

export type OfflineMapMode = 'online' | 'offline';

export type BaseMap = 'osm' | 'esriWorldImagery';

function baseMapRasterUrlTemplate(baseMap: BaseMap) {
  if (baseMap === 'esriWorldImagery') {
    // Note {y}/{x} ordering.
    return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  }
  return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
}

export type OfflineTilesState = {
  rootUri: string;
  urlTemplate: string;
  minZoom: number;
  maxZoom: number;
  status: 'idle' | 'downloading' | 'ready' | 'error';
  total: number;
  completed: number;
  failed: number;
  lastBounds: LatLonBounds | null;
  error: string | null;
};

type CadNavContextValue = {
  checkpoints: Checkpoint[];
  selectedCheckpointId: string | null;
  location: LocationState;
  placingCheckpoint: boolean;

  grid: GridConfig;
  mapDownload: MapDownloadSelection;
  offlineMapMode: OfflineMapMode;
  baseMap: BaseMap;
  offlineTiles: OfflineTilesState;

  ensureLocationPermission: () => Promise<boolean>;
  startLocation: () => Promise<void>;
  stopLocation: () => void;

  beginCheckpointPlacement: () => void;
  cancelCheckpointPlacement: () => void;
  placeCheckpointAt: (coordinate: LatLng) => void;

  registerMapController: (controller: MapController | null) => void;
  getMapInitialCenter: () => LatLng;
  setLastMapCenter: (center: LatLng) => void;
  centerOnMyLocation: () => void;
  centerOnCheckpoint: (id: string) => void;

  addCheckpointAtMapCenter: () => void;
  addCheckpointAtMyLocation: () => void;
  selectCheckpoint: (id: string | null) => void;

  setGridEnabled: (enabled: boolean) => void;
  setGridAnchorFromOffsetMeters: (
    coordinate: LatLng,
    args: { eastingMeters: number; northingMeters: number; eastingInput?: string; northingInput?: string; scaleMeters?: number }
  ) => void;

  enterMapDownloadMode: () => void;
  exitMapDownloadMode: () => void;
  registerMapDownloadTap: (coordinate: LatLng) => void;
  resetMapDownloadSelection: () => void;
  saveMapDownloadSelection: () => void;

  setOfflineMapMode: (mode: OfflineMapMode) => void;
  setBaseMap: (baseMap: BaseMap) => void;
  downloadOfflineTilesForBounds: (bounds: LatLonBounds, options?: { minZoom?: number; maxZoom?: number }) => Promise<void>;
};

const CadNavContext = createContext<CadNavContextValue | null>(null);

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const CadNavProvider: FC<PropsWithChildren> = ({ children }) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationState>({ coordinate: null, headingDeg: null });
  const [placingCheckpoint, setPlacingCheckpoint] = useState(false);

  const [grid, setGrid] = useState<GridConfig>({
    enabled: false,
    anchor: null,
    majorSpacingMeters: 1000,
    minorDivisions: 10,
  });

  const [mapDownload, setMapDownload] = useState<MapDownloadSelection>({
    active: false,
    firstCorner: null,
    secondCorner: null,
    lastSavedBounds: null,
  });

  const [offlineMapMode, setOfflineMapMode] = useState<OfflineMapMode>('online');
  const [baseMap, setBaseMap] = useState<BaseMap>('esriWorldImagery');

  const isRemoteDebugging = useMemo(() => {
    // In "Debug JS Remotely" (Chrome) / non-JSI runtimes, many Expo native modules
    // can behave oddly or present missing constants.
    // This heuristic is commonly used to detect remote debugging.
    try {
      return Platform.OS !== 'web' && typeof (globalThis as any).nativeCallSyncHook !== 'function';
    } catch {
      return false;
    }
  }, []);

  const getBestStorageRootUri = useCallback((): string | null => {
    // Prefer documentDirectory for persistence; fall back to cacheDirectory if needed.
    // Some runtimes (or misconfigured builds) can report documentDirectory as null.
    const doc = FileSystem.documentDirectory;
    const cache = (FileSystem as any).cacheDirectory as unknown;

    const docOk = typeof doc === 'string' && doc.length > 0;
    const cacheOk = typeof cache === 'string' && cache.length > 0;

    if (docOk) return doc;
    if (cacheOk) return cache as string;
    return null;
  }, []);

  const [offlineTiles, setOfflineTiles] = useState<OfflineTilesState>(() => {
    const storageRoot = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
    const rootUri = storageRoot ? `${storageRoot}cadnav2_tiles/` : '';
    return {
      rootUri,
      // IMPORTANT: choose a tile provider you have rights to use for offline caching.
      // This is just the default dev template.
      urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      minZoom: 10,
      maxZoom: 18,
      status: 'idle',
      total: 0,
      completed: 0,
      failed: 0,
      lastBounds: null,
      error: null,
    };
  });

  const mapControllerRef = useRef<MapController | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastFallbackCenterRef = useRef<LatLng>({ latitude: -36.9962, longitude: 145.0272 });
  const lastMapCenterRef = useRef<LatLng>(lastFallbackCenterRef.current);

  const setLastMapCenter = useCallback((center: LatLng) => {
    lastMapCenterRef.current = center;
    lastFallbackCenterRef.current = center;
  }, []);

  const getMapInitialCenter = useCallback(() => lastMapCenterRef.current, []);

  const ensureLocationPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }, []);

  const startLocation = useCallback(async () => {
    const granted = await ensureLocationPermission();
    if (!granted) return;

    // Per Expo Location docs, permissions can be granted while services/providers are disabled.
    // In that case, attempting to watch location may reject.
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) return;
    } catch {
      // Ignore provider checks if unavailable on the current platform.
    }

    // On web, some Expo Location versions throw when removing subscriptions.
    // Keep a single active subscription and don't restart it.
    if (Platform.OS === 'web' && locationSubRef.current) {
      return;
    }

    try {
      locationSubRef.current?.remove();
    } catch {
      // If removal is broken on this platform/runtime, avoid crashing.
    }
    locationSubRef.current = null;

    try {
      headingSubRef.current?.remove();
    } catch {
      // Ignore
    }
    headingSubRef.current = null;

    try {
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (position) => {
          setLocation((prev) => ({
            ...prev,
            coordinate: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracyMeters: position.coords.accuracy ?? null,
            updatedAt: Date.now(),
          }));
        },
        () => {
          // Avoid unhandled errors bubbling to UI; keep last known coordinate.
          setLocation((prev) => ({
            ...prev,
            updatedAt: Date.now(),
          }));
        }
      );
    } catch {
      // Some platforms/browsers can reject even after permissions are granted.
      // Keep the app responsive (LOC button shouldn't crash).
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        headingSubRef.current = await Location.watchHeadingAsync((event) => {
          const next =
            typeof event.trueHeading === 'number' && event.trueHeading >= 0
              ? event.trueHeading
              : event.magHeading;
          if (typeof next !== 'number') return;
          setLocation((prev) => ({ ...prev, headingDeg: next }));
        });
      } catch {
        // Heading may not be available on all devices/sims.
      }
    }
  }, [ensureLocationPermission]);

  const stopLocation = useCallback(() => {
    try {
      locationSubRef.current?.remove();
    } catch {
      // Ignore removal errors on platforms/runtimes with broken subscription cleanup.
    }
    locationSubRef.current = null;
    try {
      headingSubRef.current?.remove();
    } catch {
      // Ignore
    }
    headingSubRef.current = null;
  }, []);

  const registerMapController = useCallback((controller: MapController | null) => {
    mapControllerRef.current = controller;
  }, []);

  const centerOnMyLocation = useCallback(() => {
    if (!location.coordinate) return;
    setLastMapCenter(location.coordinate);
    mapControllerRef.current?.centerOn(location.coordinate, { animated: true, zoom: 16 });
  }, [location.coordinate, setLastMapCenter]);

  const centerOnCheckpoint = useCallback(
    (id: string) => {
      const target = checkpoints.find((c) => c.id === id);
      if (!target) return;
      setLastMapCenter(target.coordinate);
      mapControllerRef.current?.centerOn(target.coordinate, { animated: true, zoom: 16 });
    },
    [checkpoints, setLastMapCenter]
  );

  const addCheckpoint = useCallback((coordinate: LatLng) => {
    const nextIndex = checkpoints.length + 1;
    const cp: Checkpoint = {
      id: randomId(),
      name: `CP ${nextIndex}`,
      coordinate,
      createdAt: Date.now(),
    };

    setCheckpoints((prev) => [...prev, cp]);
    setSelectedCheckpointId(cp.id);
  }, [checkpoints.length]);

  const beginCheckpointPlacement = useCallback(() => {
    setPlacingCheckpoint(true);
  }, []);

  const cancelCheckpointPlacement = useCallback(() => {
    setPlacingCheckpoint(false);
  }, []);

  const placeCheckpointAt = useCallback(
    (coordinate: LatLng) => {
      addCheckpoint(coordinate);
    },
    [addCheckpoint]
  );

  const addCheckpointAtMapCenter = useCallback(() => {
    const center = mapControllerRef.current?.getCenter?.() ?? null;
    if (center) {
      setLastMapCenter(center);
      addCheckpoint(center);
      return;
    }

    if (location.coordinate) {
      addCheckpoint(location.coordinate);
      return;
    }

    addCheckpoint(lastFallbackCenterRef.current);
  }, [addCheckpoint, location.coordinate]);

  const addCheckpointAtMyLocation = useCallback(() => {
    if (!location.coordinate) return;
    addCheckpoint(location.coordinate);
  }, [addCheckpoint, location.coordinate]);

  const selectCheckpoint = useCallback((id: string | null) => {
    setSelectedCheckpointId(id);
  }, []);

  const setGridAnchorFromOffsetMeters = useCallback(
    (
      coordinate: LatLng,
      args: {
        eastingMeters: number;
        northingMeters: number;
        eastingInput?: string;
        northingInput?: string;
        scaleMeters?: number;
      }
    ) => {
      const anchor: GridAnchor = {
        coordinate,
        eastingMeters: args.eastingMeters,
        northingMeters: args.northingMeters,
        eastingInput: args.eastingInput,
        northingInput: args.northingInput,
        scaleMeters: args.scaleMeters,
      };
      setGrid((prev) => ({ ...prev, anchor }));
    },
    []
  );

  const setGridEnabled = useCallback(
    (enabled: boolean) => {
      setGrid((prev) => {
        if (!enabled) return { ...prev, enabled: false };

        // When enabling for the first time, pick a sensible default anchor so users
        // immediately see something without needing extra steps.
        if (prev.anchor) return { ...prev, enabled: true };

        const selected = selectedCheckpointId
          ? checkpoints.find((c) => c.id === selectedCheckpointId)?.coordinate ?? null
          : null;
        const fallback = location.coordinate ?? selected ?? lastFallbackCenterRef.current;
        const anchor: GridAnchor = { coordinate: fallback, eastingMeters: 0, northingMeters: 0 };
        return { ...prev, enabled: true, anchor };
      });
    },
    [checkpoints, location.coordinate, selectedCheckpointId]
  );

  const enterMapDownloadMode = useCallback(() => {
    setMapDownload({ active: true, firstCorner: null, secondCorner: null, lastSavedBounds: null });
  }, []);

  const exitMapDownloadMode = useCallback(() => {
    setMapDownload((prev) => ({ ...prev, active: false, firstCorner: null, secondCorner: null }));
  }, []);

  const registerMapDownloadTap = useCallback((coordinate: LatLng) => {
    setMapDownload((prev) => {
      if (!prev.active) return prev;
      if (!prev.firstCorner) return { ...prev, firstCorner: coordinate };
      if (!prev.secondCorner) return { ...prev, secondCorner: coordinate };
      return prev;
    });
  }, []);

  const resetMapDownloadSelection = useCallback(() => {
    setMapDownload((prev) => {
      if (!prev.active) return prev;
      return { ...prev, firstCorner: null, secondCorner: null };
    });
  }, []);

  const saveMapDownloadSelection = useCallback(() => {
    setMapDownload((prev) => {
      if (!prev.active) return prev;
      if (!prev.firstCorner || !prev.secondCorner) return prev;

      const latMin = Math.min(prev.firstCorner.latitude, prev.secondCorner.latitude);
      const latMax = Math.max(prev.firstCorner.latitude, prev.secondCorner.latitude);
      const lonMin = Math.min(prev.firstCorner.longitude, prev.secondCorner.longitude);
      const lonMax = Math.max(prev.firstCorner.longitude, prev.secondCorner.longitude);

      return {
        ...prev,
        active: false,
        lastSavedBounds: { latMin, latMax, lonMin, lonMax },
        firstCorner: null,
        secondCorner: null,
      };
    });
  }, []);

  const downloadOfflineTilesForBounds = useCallback(
    async (bounds: LatLonBounds, options?: { minZoom?: number; maxZoom?: number }) => {
      if (Platform.OS === 'web') return;

      // If expo-file-system isn't properly available (e.g. running on web, or a native client
      // without the module), its functions/properties may be undefined.
      const hasFsFns =
        typeof (FileSystem as any).downloadAsync === 'function' &&
        typeof (FileSystem as any).makeDirectoryAsync === 'function' &&
        typeof (FileSystem as any).getInfoAsync === 'function';
      if (!hasFsFns) {
        setOfflineTiles((prev) => ({
          ...prev,
          status: 'error',
          error:
            `Offline downloads are unavailable because expo-file-system is not loaded in this runtime. ` +
            `platform=${Platform.OS} appOwnership=${String((Constants as any)?.appOwnership)} executionEnvironment=${String(
              (Constants as any)?.executionEnvironment
            )} ` +
            `documentDirectory=${String((FileSystem as any).documentDirectory)} ` +
            `cacheDirectory=${String((FileSystem as any).cacheDirectory)}. ` +
            `${isRemoteDebugging ? 'Remote JS debugging appears to be enabled; disable "Debug JS Remotely" and reload. ' : ''}` +
            `If you're using an Android emulator, make sure the app is running in Expo Go (or a dev build) via \"Run on Android\"/press \"a\" in the Expo CLI, not in the web browser.`,
        }));
        return;
      }

      const storageRoot = getBestStorageRootUri();
      if (!storageRoot) {
        setOfflineTiles((prev) => ({
          ...prev,
          status: 'error',
          error:
            `File storage root is unavailable (no documentDirectory or cacheDirectory). ` +
            `platform=${Platform.OS} appOwnership=${String((Constants as any)?.appOwnership)} executionEnvironment=${String(
              (Constants as any)?.executionEnvironment
            )} documentDirectory=${String((FileSystem as any).documentDirectory)} cacheDirectory=${String(
              (FileSystem as any).cacheDirectory
            )}. ` +
            `${isRemoteDebugging ? 'Remote JS debugging appears to be enabled; disable "Debug JS Remotely" and reload. ' : ''}` +
            `If this is an emulator/device, it usually means you're not running a native build with expo-file-system (or the module failed to load).`,
        }));
        return;
      }

      if (offlineMapMode === 'offline') {
        // In offline mode we should not pull tiles over the network.
        setOfflineTiles((prev) => ({
          ...prev,
          status: 'error',
          error: 'Offline mode is enabled. Switch to online mode to download new tiles.',
        }));
        return;
      }

      if (baseMap === 'osm') {
        setOfflineTiles((prev) => ({
          ...prev,
          status: 'error',
          error:
            "Offline downloads are disabled for OpenStreetMap's public tile servers (they will block bulk usage). Switch to Esri imagery or configure a tile provider you have caching rights for.",
        }));
        return;
      }

      const urlTemplate = baseMapRasterUrlTemplate(baseMap);
      const minZoom = options?.minZoom ?? offlineTiles.minZoom;
      const maxZoom = options?.maxZoom ?? offlineTiles.maxZoom;
      const rootUri = `${storageRoot}cadnav2_tiles/`;

      // MARK: Pure planning step (no IO)
      // This keeps all tile math and cap logic in one place and makes the eventual
      // downloader implementation much easier to reason about.
      const planned = buildOfflineDownloadPlan({
        bounds,
        urlTemplate,
        rootUri,
        minZoom,
        maxZoom,
        maxTiles: 4000,
      });

      if (!planned.ok) {
        setOfflineTiles((prev) => ({
          ...prev,
          status: 'error',
          error: planned.error,
        }));
        return;
      }

      const plan = planned.plan;

      setOfflineTiles((prev) => ({
        ...prev,
        rootUri: plan.rootUri,
        urlTemplate: plan.urlTemplate,
        minZoom: plan.minZoom,
        maxZoom: plan.maxZoom,
        total: plan.total,
        completed: 0,
        failed: 0,
        lastBounds: plan.bounds,
        status: 'downloading',
        error: null,
      }));

      // MARK: IO step (stubbed)
      // The actual downloader is intentionally not implemented yet.
      // A future contributor should implement offlineTileDownloader.download() using expo-file-system.
      try {
        await offlineTileDownloader.download(plan, {
          concurrency: 6,
          skipExisting: true,
          retries: 0,
          onProgress: (p) => {
            setOfflineTiles((prev) => ({ ...prev, completed: p.completed, failed: p.failed, total: p.total }));
          },
        });

        setOfflineTiles((prev) => ({
          ...prev,
          status: 'ready',
        }));
      } catch (e: any) {
        const message =
          typeof e?.message === 'string'
            ? e.message
            : (() => {
                try {
                  return String(e);
                } catch {
                  return 'Unknown error';
                }
              })();

        setOfflineTiles((prev) => ({
          ...prev,
          status: 'error',
          error: message,
        }));
      }
    },
    [baseMap, getBestStorageRootUri, isRemoteDebugging, offlineMapMode, offlineTiles.maxZoom, offlineTiles.minZoom]
  );

  const value: CadNavContextValue = useMemo(
    () => ({
      checkpoints,
      selectedCheckpointId,
      location,
      placingCheckpoint,

      grid,
      mapDownload,
      offlineMapMode,
      baseMap,
      offlineTiles,

      ensureLocationPermission,
      startLocation,
      stopLocation,

      beginCheckpointPlacement,
      cancelCheckpointPlacement,
      placeCheckpointAt,

      registerMapController,
      getMapInitialCenter,
      setLastMapCenter,
      centerOnMyLocation,
      centerOnCheckpoint,

      addCheckpointAtMapCenter,
      addCheckpointAtMyLocation,
      selectCheckpoint,

      setGridEnabled,
      setGridAnchorFromOffsetMeters,

      enterMapDownloadMode,
      exitMapDownloadMode,
      registerMapDownloadTap,
      resetMapDownloadSelection,
      saveMapDownloadSelection,

      setOfflineMapMode,
      setBaseMap,
      downloadOfflineTilesForBounds,
    }),
    [
      checkpoints,
      selectedCheckpointId,
      location,
      placingCheckpoint,
      grid,
      mapDownload,
      offlineMapMode,
      baseMap,
      offlineTiles,
      ensureLocationPermission,
      startLocation,
      stopLocation,
      beginCheckpointPlacement,
      cancelCheckpointPlacement,
      placeCheckpointAt,
      registerMapController,
      getMapInitialCenter,
      setLastMapCenter,
      centerOnMyLocation,
      centerOnCheckpoint,
      addCheckpointAtMapCenter,
      addCheckpointAtMyLocation,
      selectCheckpoint,
      setGridEnabled,
      setGridAnchorFromOffsetMeters,
      enterMapDownloadMode,
      exitMapDownloadMode,
      registerMapDownloadTap,
      resetMapDownloadSelection,
      saveMapDownloadSelection,

      setOfflineMapMode,
      setBaseMap,
      downloadOfflineTilesForBounds,
    ]
  );

  return <CadNavContext.Provider value={value}>{children}</CadNavContext.Provider>;
};

export function useCadNav() {
  const ctx = useContext(CadNavContext);
  if (!ctx) throw new Error('useCadNav must be used within CadNavProvider');
  return ctx;
}
