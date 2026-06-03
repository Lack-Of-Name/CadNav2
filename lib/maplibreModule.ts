import { Platform } from 'react-native';

let maplibreModule: unknown | null | undefined;

/**
 * Lazy-load @maplibre/maplibre-react-native so Expo Go does not hard-crash
 * when the native module is missing. Returns null on web or when unavailable.
 */
export function getMaplibreModule(): Record<string, unknown> | null {
  if (maplibreModule !== undefined) {
    return maplibreModule as Record<string, unknown> | null;
  }
  if (Platform.OS === 'web') {
    maplibreModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const req = require('@maplibre/maplibre-react-native') as { default?: unknown };
    maplibreModule = (req.default ?? req) as Record<string, unknown>;
  } catch {
    maplibreModule = null;
  }
  return maplibreModule as Record<string, unknown> | null;
}
