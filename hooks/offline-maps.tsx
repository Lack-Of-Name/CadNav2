import { alert as showAlert } from '@/components/alert';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// ---------- Types ----------
export type OfflinePack = {
  name: string;
  state: string;
  progress: number; // 0-100
  completedCount: number;
  requiredCount: number;
  completedSize: number; // bytes
  metadata?: Record<string, string>;
};

export type ZoomPreset = {
  label: string;
  description: string;
  minZoom: number;
  maxZoom: number;
  estimateLabel: string;
};

export const ZOOM_PRESETS: ZoomPreset[] = [
  { label: 'Overview', description: 'Zoom 1–8 · Country / region scale', minZoom: 1, maxZoom: 8, estimateLabel: '~5 MB' },
  { label: 'Navigation', description: 'Zoom 1–13 · Road & trail level', minZoom: 1, maxZoom: 13, estimateLabel: '~50 MB' },
  { label: 'Detailed', description: 'Zoom 1–16 · Full detail for fieldwork', minZoom: 1, maxZoom: 16, estimateLabel: '~200+ MB' },
];

export type DownloadTarget = {
  latitude: number;
  longitude: number;
  label: string; // e.g. "My location" or "Custom (51.5, -0.1)"
  radiusKm: number;
};

type ActiveDownload = {
  packName: string;
  presetLabel: string;
  targetLabel: string;
  progress: number; // 0-100
};

type OfflineMapContextValue = {
  // Packs
  packs: OfflinePack[];
  loadingPacks: boolean;
  loadPacks: () => Promise<void>;
  deletePack: (name: string) => Promise<void>;

  // Downloads
  activeDownload: ActiveDownload | null;
  startDownload: (preset: ZoomPreset, target: DownloadTarget, apiKey: string) => Promise<void>;

  // Ambient cache
  initOffline: () => void;
};

const OfflineMapContext = createContext<OfflineMapContextValue>({
  packs: [],
  loadingPacks: false,
  loadPacks: async () => {},
  deletePack: async () => {},
  activeDownload: null,
  startDownload: async () => {},
  initOffline: () => {},
});

export function useOfflineMaps() {
  return useContext(OfflineMapContext);
}

// ---------- Helpers ----------
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function boundsFromCenter(lat: number, lon: number, radiusKm: number): [[number, number], [number, number]] {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [
    [lon - lonDelta, lat - latDelta], // SW
    [lon + lonDelta, lat + latDelta], // NE
  ];
}

// ---------- Provider ----------
export function OfflineMapProvider({ children }: { children: React.ReactNode }) {
  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [activeDownload, setActiveDownload] = useState<ActiveDownload | null>(null);
  const initializedRef = useRef(false);

  const getOfflineManager = useCallback(() => {
    if (isWeb) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ml = require('@maplibre/maplibre-react-native');
      return ml.offlineManager ?? ml.default?.offlineManager ?? null;
    } catch {
      return null;
    }
  }, []);

  // Increase ambient cache so tiles viewed online are kept for offline use too
  const initOffline = useCallback(() => {
    if (isWeb || initializedRef.current) return;
    initializedRef.current = true;
    const mgr = getOfflineManager();
    if (!mgr) return;
    try {
      // 250 MB ambient cache — tiles you browse online are kept for offline use automatically
      mgr.setMaximumAmbientCacheSize?.(250 * 1024 * 1024);
    } catch {
      // best-effort
    }
  }, [getOfflineManager]);

  const loadPacks = useCallback(async () => {
    const mgr = getOfflineManager();
    if (!mgr) return;
    setLoadingPacks(true);
    try {
      const existing = await mgr.getPacks();
      const mapped: OfflinePack[] = (existing ?? []).map((p: any) => ({
        name: p.name ?? 'Unknown',
        state: p.pack?._metadata?.state ?? 'complete',
        progress: p.pack?.progress?.percentage ?? 100,
        completedCount: p.pack?.progress?.countOfResourcesCompleted ?? 0,
        requiredCount: p.pack?.progress?.countOfResourcesExpected ?? 0,
        completedSize: p.pack?.progress?.countOfBytesCompleted ?? 0,
        metadata: p.pack?._metadata,
      }));
      setPacks(mapped);
    } catch (err) {
      void showAlert({ title: 'Offline Maps', message: `Failed to load packs: ${err}` });
    } finally {
      setLoadingPacks(false);
    }
  }, [getOfflineManager]);

  const deletePack = useCallback(
    async (name: string) => {
      const mgr = getOfflineManager();
      if (!mgr) return;
      await showAlert({
        title: 'Delete Map Pack',
        message: `Delete "${name}"? This cannot be undone.`,
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await mgr.deletePack(name);
                setPacks((prev) => prev.filter((p) => p.name !== name));
              } catch (err) {
                void showAlert({ title: 'Error', message: String(err) });
              }
            },
          },
        ],
      });
    },
    [getOfflineManager],
  );

  const startDownload = useCallback(
    async (preset: ZoomPreset, target: DownloadTarget, apiKey: string) => {
      if (isWeb) return;

      const mgr = getOfflineManager();
      if (!mgr) {
        void showAlert({ title: 'Offline Maps', message: 'Offline manager not available.' });
        return;
      }

      const bounds = boundsFromCenter(target.latitude, target.longitude, target.radiusKm);
      const packName = `CadNav_${preset.label}_${Date.now()}`;
      const styleUrl = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

      setActiveDownload({
        packName,
        presetLabel: preset.label,
        targetLabel: target.label,
        progress: 0,
      });

      try {
        await mgr.createPack(
          {
            name: packName,
            styleURL: styleUrl,
            bounds,
            minZoom: preset.minZoom,
            maxZoom: preset.maxZoom,
            metadata: {
              name: packName,
              preset: preset.label,
              target: target.label,
              radiusKm: String(target.radiusKm),
              created: new Date().toISOString(),
            },
          },
          (_region: any, status: any) => {
            const pct = status?.percentage ?? 0;
            setActiveDownload((prev) =>
              prev ? { ...prev, progress: pct } : null,
            );
            if (pct >= 100) {
              setTimeout(() => {
                setActiveDownload(null);
                void loadPacks();
              }, 800);
            }
          },
          (_region: any, err: any) => {
            setActiveDownload(null);
            void showAlert({ title: 'Download Error', message: String(err) });
          },
        );

        // Reload packs after download starts
        setTimeout(() => void loadPacks(), 1500);
      } catch (err) {
        void showAlert({ title: 'Download Error', message: String(err) });
        setActiveDownload(null);
      }
    },
    [getOfflineManager, loadPacks],
  );

  return (
    <OfflineMapContext.Provider
      value={{
        packs,
        loadingPacks,
        loadPacks,
        deletePack,
        activeDownload,
        startDownload,
        initOffline,
      }}
    >
      {children}
    </OfflineMapContext.Provider>
  );
}
