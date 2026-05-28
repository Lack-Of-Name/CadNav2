# CadNav2 Quick Read Index

This file is the fastest way to understand where the app lives and which files to read first.

## Read This First

1. [app/_layout.tsx](../app/_layout.tsx) for global providers, routing, and runtime error handling.
2. [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx) for the tab route shell that now stays hidden.
3. [app/(tabs)/index.tsx](../app/(tabs)/index.tsx) for the main map screen entry point.
4. [components/map/MaplibreMap.tsx](../components/map/MaplibreMap.tsx) for the primary map behavior and screen controls.
5. [components/map/MaplibreMap.utils.tsx](../components/map/MaplibreMap.utils.tsx) for shared map math and reusable HUD/button helpers.

## App Shape

- [app/(tabs)/routes.tsx](../app/(tabs)/routes.tsx) handles route management and route-related calculations.
- [app/(tabs)/settings.tsx](../app/(tabs)/settings.tsx) handles settings, map preferences, and app-wide toggles.
- [app/modal.tsx](../app/modal.tsx) exists as a modal route and should be treated as a separate navigation surface.

## Map System

- [components/map/MaplibreMap.tsx](../components/map/MaplibreMap.tsx) is the central map wrapper.
- [components/map/CompassOverlay.tsx](../components/map/CompassOverlay.tsx) renders the compass HUD.
- [components/map/MapGrid.ts](../components/map/mapGrid.ts) contains grid reference math and conversion helpers.
- [components/map/converter.tsx](../components/map/converter.tsx) contains coordinate and declination conversion helpers.
- [components/map/MapTilerKeyProvider.tsx](../components/map/MapTilerKeyProvider.tsx) supplies the MapTiler API key context.
- [components/map/gridoverlay.web.tsx](../components/map/gridoverlay.web.tsx) is the web-only grid overlay implementation.

## UI Building Blocks

- [components/ui/DrawerMenu.tsx](../components/ui/DrawerMenu.tsx) is the navigation drawer UI.
- [components/ui/StyledButton.tsx](../components/ui/StyledButton.tsx) is the shared button style.
- [components/ui/ThemeSwitch.tsx](../components/ui/ThemeSwitch.tsx) is the theme toggle.
- [components/ui/collapsible.tsx](../components/ui/collapsible.tsx) is the shared collapsible section primitive.
- [components/themed-text.tsx](../components/themed-text.tsx) and [components/themed-view.tsx](../components/themed-view.tsx) provide theme-aware primitives.

## State And Data Hooks

- [hooks/gps.tsx](../hooks/gps.tsx) manages location and heading updates.
- [hooks/checkpoints.tsx](../hooks/checkpoints.tsx) manages saved checkpoints and route data.
- [hooks/offline-maps.tsx](../hooks/offline-maps.tsx) manages offline map packs.
- [hooks/settings.tsx](../hooks/settings.tsx) stores persistent app settings.
- [hooks/use-color-scheme.ts](../hooks/use-color-scheme.ts) and [hooks/use-color-scheme.web.ts](../hooks/use-color-scheme.web.ts) provide platform-specific color scheme detection.

## Constants And Assets

- [constants/theme.ts](../constants/theme.ts) defines the app color system and theme values.
- [constants/emojis.ts](../constants/emojis.ts) feeds the emoji picker.
- [assets/](../assets/) contains map sources, icons, and bundled static assets.

## Clean-Up Notes

- The old `MaplibreMap.general.tsx` name was too vague, so the shared helper code now lives in [components/map/MaplibreMap.utils.tsx](../components/map/MaplibreMap.utils.tsx).
- The bottom tab route layout is still present for routing, but the visible navigation lives inside the map screen.
- The coordinate-to-grid conversion code is intentionally split across the map helper files so the grid workflow stays isolated from UI code.