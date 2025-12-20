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
import type { LatLng } from '../utils/geo';
import type { GridAnchor, GridConfig } from '../utils/grid';

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

type CadNavContextValue = {
  checkpoints: Checkpoint[];
  selectedCheckpointId: string | null;
  location: LocationState;
  placingCheckpoint: boolean;

  grid: GridConfig;

  ensureLocationPermission: () => Promise<boolean>;
  startLocation: () => Promise<void>;
  stopLocation: () => void;

  beginCheckpointPlacement: () => void;
  cancelCheckpointPlacement: () => void;
  placeCheckpointAt: (coordinate: LatLng) => void;

  registerMapController: (controller: MapController | null) => void;
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

  const mapControllerRef = useRef<MapController | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastFallbackCenterRef = useRef<LatLng>({ latitude: -36.9962, longitude: 145.0272 });

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
    lastFallbackCenterRef.current = location.coordinate;
    mapControllerRef.current?.centerOn(location.coordinate, { animated: true, zoom: 16 });
  }, [location.coordinate]);

  const centerOnCheckpoint = useCallback(
    (id: string) => {
      const target = checkpoints.find((c) => c.id === id);
      if (!target) return;
      lastFallbackCenterRef.current = target.coordinate;
      mapControllerRef.current?.centerOn(target.coordinate, { animated: true, zoom: 16 });
    },
    [checkpoints]
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
      lastFallbackCenterRef.current = center;
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

  const value: CadNavContextValue = useMemo(
    () => ({
      checkpoints,
      selectedCheckpointId,
      location,
      placingCheckpoint,

      grid,

      ensureLocationPermission,
      startLocation,
      stopLocation,

      beginCheckpointPlacement,
      cancelCheckpointPlacement,
      placeCheckpointAt,

      registerMapController,
      centerOnMyLocation,
      centerOnCheckpoint,

      addCheckpointAtMapCenter,
      addCheckpointAtMyLocation,
      selectCheckpoint,

      setGridEnabled,
      setGridAnchorFromOffsetMeters,
    }),
    [
      checkpoints,
      selectedCheckpointId,
      location,
      placingCheckpoint,
      grid,
      ensureLocationPermission,
      startLocation,
      stopLocation,
      beginCheckpointPlacement,
      cancelCheckpointPlacement,
      placeCheckpointAt,
      registerMapController,
      centerOnMyLocation,
      centerOnCheckpoint,
      addCheckpointAtMapCenter,
      addCheckpointAtMyLocation,
      selectCheckpoint,
      setGridEnabled,
      setGridAnchorFromOffsetMeters,
    ]
  );

  return <CadNavContext.Provider value={value}>{children}</CadNavContext.Provider>;
};

export function useCadNav() {
  const ctx = useContext(CadNavContext);
  if (!ctx) throw new Error('useCadNav must be used within CadNavProvider');
  return ctx;
}
