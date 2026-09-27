import { SETTINGS as SETTINGS_STORAGE_KEY } from '@/constants/storageKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * App settings
 *
 * Goals:
 * - Single place to define settings (defaults + validation/parsing).
 * - Automatically loads at app launch (via SettingsProvider in app/_layout.tsx).
 * - Persists to AsyncStorage.
 *
 * Adding a new setting:
 * - Add a new entry to SETTINGS_DEFS.
 * - Consume it via `useSettings()` (e.g. const { mySetting, setSetting } = useSettings()).
 *   or `useSetting('mySetting')`.
 */

export type AngleUnit = 'mils' | 'degrees';
export type MapLayer = 'outdoor' | 'satellite';
export type ThemeMode = 'system' | 'light' | 'dark';
export type GpsMode = 'highAccuracy' | 'gpsOnly' | 'powerSave' | 'super';

function isAngleUnit(value: unknown): value is AngleUnit {
  return value === 'mils' || value === 'degrees';
}

function isMapLayer(value: unknown): value is MapLayer {
  return value === 'outdoor' || value === 'satellite';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

type SettingDef<T> = {
  /** Default value used when storage is missing/invalid. */
  default: T;
  /** Converts whatever is in storage into a valid value for the app. */
  parse: (raw: unknown) => T;
};

/**
 * Settings registry.
 *
 * This is the only place you should need to touch when adding settings.
 * Keep parsers strict: treat unknown values as defaults.
 */
const SETTINGS_DEFS = {
  angleUnit: {
    default: 'mils' as AngleUnit,
    parse: (raw: unknown) => (isAngleUnit(raw) ? raw : 'mils'),
  },
  mapHeading: {
    default: 'true' as 'true' | 'magnetic',
    parse: (raw: unknown) => (raw === 'magnetic' ? 'magnetic' : 'true'),
  },
  mapLayer: {
    default: 'outdoor' as MapLayer,
    parse: (raw: unknown) => (isMapLayer(raw) ? raw : 'outdoor'),
  },
  themeMode: {
    default: 'system' as ThemeMode,
    parse: (raw: unknown) => (isThemeMode(raw) ? raw : 'system'),
  },
  mapGridEnabled: {
    default: false,
    parse: (raw: unknown) => raw === true,
  },
  mapGridSubdivisionsEnabled: {
    default: true,
    parse: (raw: unknown) => raw !== false,
  },
  mapGridNumbersEnabled: {
    default: false,
    parse: (raw: unknown) => raw === true,
  },
  gpsMode: {
    default: 'highAccuracy' as GpsMode,
    parse: (raw: unknown) => {
      if (raw === 'gpsOnly' || raw === 'powerSave' || raw === 'super') return raw;
      return 'highAccuracy';
    },
  },
  locationDotColor: {
    // null = follow the theme primary colour (adapts to light/dark).
    default: null as string | null,
    parse: (raw: unknown) =>
      typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : null,
  },
  mapBrightness: {
    // Map tile brightness, percent. 100 = full brightness (overlay disabled),
    // 0 = fully blacked out.
    default: 100,
    parse: (raw: unknown) =>
      typeof raw === 'number' && Number.isFinite(raw)
        ? Math.min(100, Math.max(0, Math.round(raw)))
        : 100,
  },
} as const;

const SETTING_KEYS = Object.keys(SETTINGS_DEFS) as Array<keyof typeof SETTINGS_DEFS>;

export type MapHeading = 'true' | 'magnetic';

export type Settings = {
  angleUnit: AngleUnit;
  mapHeading: MapHeading;
  mapLayer: MapLayer;
  themeMode: ThemeMode;
  mapGridEnabled: boolean;
  mapGridSubdivisionsEnabled: boolean;
  mapGridNumbersEnabled: boolean;
  gpsMode: GpsMode;
  locationDotColor: string | null;
  mapBrightness: number;
};

type PersistedRecord = Record<string, unknown>;

type SettingsContextValue = {
  settings: Settings;
  isLoaded: boolean;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
};

function buildDefaultSettings(): Settings {
  return {
    angleUnit: SETTINGS_DEFS.angleUnit.default,
    mapHeading: SETTINGS_DEFS.mapHeading.default,
    mapLayer: SETTINGS_DEFS.mapLayer.default,
    mapGridEnabled: SETTINGS_DEFS.mapGridEnabled.default,
    themeMode: SETTINGS_DEFS.themeMode.default,
    mapGridSubdivisionsEnabled: SETTINGS_DEFS.mapGridSubdivisionsEnabled.default,
    mapGridNumbersEnabled: SETTINGS_DEFS.mapGridNumbersEnabled.default,
    gpsMode: SETTINGS_DEFS.gpsMode.default,
    locationDotColor: SETTINGS_DEFS.locationDotColor.default,
    mapBrightness: SETTINGS_DEFS.mapBrightness.default,
  } as Settings;
}

function hydrateSettings(persisted: PersistedRecord | null): Settings {
  return {
    angleUnit: SETTINGS_DEFS.angleUnit.parse(persisted ? persisted['angleUnit'] : undefined),
    mapHeading: SETTINGS_DEFS.mapHeading.parse(persisted ? persisted['mapHeading'] : undefined),
    mapLayer: SETTINGS_DEFS.mapLayer.parse(persisted ? persisted['mapLayer'] : undefined),
    mapGridEnabled: SETTINGS_DEFS.mapGridEnabled.parse(persisted ? persisted['mapGridEnabled'] : undefined),
    themeMode: SETTINGS_DEFS.themeMode.parse(persisted ? persisted['themeMode'] : undefined),
    mapGridSubdivisionsEnabled: SETTINGS_DEFS.mapGridSubdivisionsEnabled.parse(persisted ? persisted['mapGridSubdivisionsEnabled'] : undefined),
    mapGridNumbersEnabled: SETTINGS_DEFS.mapGridNumbersEnabled.parse(persisted ? persisted['mapGridNumbersEnabled'] : undefined),
    gpsMode: SETTINGS_DEFS.gpsMode.parse(persisted ? persisted['gpsMode'] : undefined),
    locationDotColor: SETTINGS_DEFS.locationDotColor.parse(persisted ? persisted['locationDotColor'] : undefined),
    mapBrightness: SETTINGS_DEFS.mapBrightness.parse(persisted ? persisted['mapBrightness'] : undefined),
  } as Settings;
}

/** Read raw settings JSON from storage (may be missing/invalid). */
async function readPersistedSettings(): Promise<PersistedRecord | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    // We only accept a plain object.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as PersistedRecord;
  } catch {
    return null;
  }
}

/** Persist the normalized, fully-typed settings object. */
async function writePersistedSettings(next: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => buildDefaultSettings());
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef<Settings>(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const persisted = await readPersistedSettings();

      // Normalize + validate everything coming from storage.
      const hydrated = hydrateSettings(persisted);

      if (!cancelled) {
        settingsRef.current = hydrated;
        setSettings(hydrated);
        setIsLoaded(true);
      }

      // Ensure a complete normalized object exists in storage (initialize on first launch).
      // Safe to do even if already present.
      await writePersistedSettings(hydrated);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Set exactly one setting (and persist). */
  const setSetting = useCallback(async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next;
    setSettings(next);
    await writePersistedSettings(next);
  }, []);

  /** Patch multiple settings at once (and persist once). */
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    await writePersistedSettings(next);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      isLoaded,
      setSetting,
      updateSettings,
    }),
    [settings, isLoaded, setSetting, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings & SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }

  // Convenience: expose settings keys at top level so consumers can write:
  //   const { angleUnit, setSetting } = useSettings();
  // Note: this also includes `settings` as a property if you prefer it.
  return {
    ...ctx.settings,
    ...ctx,
  };
}

/**
 * Typed accessor for a single setting.
 *
 * Example:
 *   const [angleUnit, setAngleUnit] = useSetting('angleUnit');
 */
export function useSetting<K extends keyof Settings>(key: K): readonly [Settings[K], (value: Settings[K]) => Promise<void>] {
  const { settings, setSetting } = useContextRequired();
  const setter = useCallback((value: Settings[K]) => setSetting(key, value), [key, setSetting]);
  return [settings[key], setter] as const;
}

export function getMapStyleUrl(layer: MapLayer, apiKey: string): string {
  const styleId = layer === 'satellite' ? 'satellite' : 'outdoor-v2';
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${apiKey}`;
}

function useContextRequired(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings/useSetting must be used within a SettingsProvider');
  }
  return ctx;
}
