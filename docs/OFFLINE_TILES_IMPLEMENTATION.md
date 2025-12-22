# Offline Tiles (PNG) — Implementation Notes

This project intentionally keeps the **selection UX** + **offline rendering** in place, but leaves the **tile download IO** as a stub.

The goal is to make the real implementation straightforward for a contributor.

## Overview

There are three layers:

1) **Planning (pure)** — `app/utils/offlineDownloadPlan.ts`
- Inputs: bounds, zoom range, URL template, rootUri
- Output: a concrete list of `{z,x,y}` tiles plus metadata (`total`, final `maxZoom` after applying the tile cap)
- This file contains the “tile cap” logic so the IO layer never needs to think about it.

2) **Downloader contract (native IO)** — `app/utils/offlineTileDownloader.native.ts`
- Exports `offlineTileDownloader.download(plan, options)`.
- CURRENTLY: throws “not implemented”.
- This is where the real code should be written using `expo-file-system`.

3) **App state + UI wiring** — `app/state/CadNavContext.tsx`
- Builds a plan, updates `offlineTiles` state for progress UI, then calls the downloader.
- Any thrown error becomes `offlineTiles.status='error'` and is surfaced via banner/progress text.

## Storage layout (must not change)

All code assumes tiles live at:

- `{rootUri}/{z}/{x}/{y}.png`

`rootUri` must end in `/`.

Native rendering uses `react-native-maps` `LocalTile` via:

- `offlineTileTemplateUri = {rootUri}{z}/{x}/{y}.png`

So the downloader must write files exactly to that pattern.

## Provider templates

The plan uses a generic `{z}/{x}/{y}` placeholder approach.

- OSM raster: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- Esri World Imagery: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`

Notice Esri swaps `{x}` and `{y}` ordering — the template handles that.

## Implementation checklist for the real downloader

In `app/utils/offlineTileDownloader.native.ts`:

- MARK: Choose storage root
  - Use `FileSystem.documentDirectory` when available
  - Fall back to `FileSystem.cacheDirectory` if needed

- MARK: Ensure directories
  - `makeDirectoryAsync(plan.rootUri, { intermediates: true })`
  - For each tile, ensure `{rootUri}{z}/{x}/` exists

- MARK: Download tiles
  - Render remote URL from template
  - Render local file URI `{rootUri}{z}/{x}/{y}.png`
  - Download to that file
  - Treat non-2xx as failure (some APIs resolve with a status)

- MARK: Concurrency
  - Use a small concurrency (4–8)
  - Update progress periodically via `onProgress`

- MARK: Policies
  - Do not bulk download OSM public tiles (they will block you)

## Why the stub exists

We hit runtime-specific issues (Expo Go vs remote debugging, module availability, provider errors). The owner requested that implementation be handed off, but kept the scaffolding and UI intact.
