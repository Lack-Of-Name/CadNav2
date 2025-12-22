import type { OfflineDownloadPlan } from './offlineDownloadPlan';

export type OfflineTileDownloadProgress = {
  total: number;
  completed: number;
  failed: number;
};

export type OfflineTileDownloader = {
  // MARK: Core contract
  // Implementations must download PNG tiles from plan.urlTemplate into plan.rootUri
  // using the exact local layout: {rootUri}/{z}/{x}/{y}.png
  //
  // The rest of the app assumes that Offline mode rendering uses the same rootUri
  // via react-native-maps LocalTile pathTemplate.
  download: (
    plan: OfflineDownloadPlan,
    options: {
      // MARK: Perf/robustness knobs
      concurrency?: number;
      // Optional: allow caller to cancel.
      signal?: AbortSignal;
      // Report progress for UI.
      onProgress?: (p: OfflineTileDownloadProgress) => void;

      // MARK: Behavior
      // If true, skip existing tiles.
      skipExisting?: boolean;
      // Optional retry count per-tile.
      retries?: number;
    }
  ) => Promise<void>;
};

// MARK: Reference implementation notes (for whoever wires this up)
//
// A real downloader should:
// 1) Choose a storage root (Expo FileSystem documentDirectory preferred, cacheDirectory fallback)
// 2) Ensure plan.rootUri exists (makeDirectoryAsync with intermediates)
// 3) For each tile:
//    - Build remote URL from plan.urlTemplate (see renderRemoteUrl)
//    - Build local URI: {rootUri}{z}/{x}/{y}.png
//    - Ensure directory {rootUri}{z}/{x}/ exists
//    - Download bytes to local path
//    - Treat non-2xx HTTP responses as failures (some APIs resolve with status)
// 4) Concurrency-limit work (e.g. 4–8) and update progress every N tiles
// 5) Consider provider ToS: do not bulk download OSM public tiles.
//
// MARK: CURRENT STATUS
// This scaffold intentionally does NOT implement the actual downloads.
// The project owner requested to leave the IO implementation to another contributor.
export const offlineTileDownloader: OfflineTileDownloader = {
  async download() {
    throw new Error(
      'Offline tile downloading is not implemented yet. ' +
        'Implement app/utils/offlineTileDownloader.native.ts using expo-file-system (or an alternative) ' +
        'to fetch PNG tiles and write them under {rootUri}/{z}/{x}/{y}.png. '
    );
  },
};
