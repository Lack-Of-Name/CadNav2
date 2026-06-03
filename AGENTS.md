# CadNav2 — agent and contributor guide

CadNav2 is an Expo Router React Native app for cadet-style navigation: MapLibre maps, grid references, GPS, routes, and offline tiles.

## Start here

1. [docs/quick-read-index.md](docs/quick-read-index.md) — file-by-file map of the repo.
2. [app/_layout.tsx](app/_layout.tsx) — providers, global drawer, error handling.
3. [components/map/MaplibreMap.tsx](components/map/MaplibreMap.tsx) — main map screen (large; search before editing blindly).

## Layout

| Area | Role |
|------|------|
| `app/` | Expo Router screens (`(tabs)/index` = map, `routes`, `settings`) |
| `components/` | UI and modals; map code under `components/map/` |
| `hooks/` | State: `settings`, `checkpoints`, `gps`, `offline-maps`, `use-workspace-routes` |
| `constants/` | Theme, emojis, **storage keys** |
| `types/` | Shared domain types (`Checkpoint`, `WorkspaceRoute`, `SavedRoute`, …) |
| `lib/` | Small pure helpers (geo distance, color contrast, MapLibre lazy load) |

Path alias: `@/*` → project root (`tsconfig.json`).

## Two route stores (do not confuse)

| Concept | Storage key | Constant | Hook / screen |
|---------|-------------|----------|----------------|
| **Workspace** — route cards on Routes tab (title, icon, color, checkpoints) | `APP_ROUTES` | `WORKSPACE_ROUTES` | `useWorkspaceRoutes`, `app/(tabs)/routes.tsx` |
| **Saved library** — named routes for “Saved” when adding points | `cadnav2.routes.v1` | `SAVED_ROUTES` | `useCheckpoints` → `savedRoutes` |

Export/share backup on Routes tab dumps **workspace** JSON only. “Save to library” writes **saved** routes via `saveRoute()` in checkpoints.

## Patterns to follow

- **New settings:** add to `SETTINGS_DEFS` in [hooks/settings.tsx](hooks/settings.tsx); read with `useSettings()`.
- **New persisted data:** add a key in [constants/storageKeys.ts](constants/storageKeys.ts); document shape in a comment.
- **New types:** [types/index.ts](types/index.ts); re-export from hooks if needed for existing imports.
- **MapLibre native module:** use [lib/maplibreModule.ts](lib/maplibreModule.ts) — never `require('@maplibre/...')` inline (Expo Go safety).
- **Imports:** prefer `@/` over deep relative paths.

## Conventions

- Tab bar is hidden; navigation uses [components/ui/DrawerMenu.tsx](components/ui/DrawerMenu.tsx).
- Checkpoints hook uses a module singleton + listeners (not React Context); treat `useCheckpoints` as the public API.
- Default export: `MaplibreMap`, `StyledButton`; most other components use named exports.

## Safe change checklist

- Run `npm run lint` after edits.
- Map screen needs a dev client or release build (native MapLibre), not stock Expo Go.
- Keep workspace vs saved route storage separate unless you implement a migration.

## Out of scope for drive-by edits

- Splitting `MaplibreMap.tsx` (~1.6k lines) — planned but not required for small fixes.
- `app/modal.tsx` — Expo template route, low priority.
