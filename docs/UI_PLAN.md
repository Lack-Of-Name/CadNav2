# CadNav 2 — UI plan (workshop draft)

## Goals
- Full-screen, map-first experience (maximize usable map area)
- Multiple full pages you can swipe between (mobile-native feel)
- Works on phone first, scales to tablet/desktop
- No server dependencies; offline-first defaults
- Minimal taps, clear state, consistent controls

## Navigation model
- **Primary navigation: swipe between full pages**
  - Pages: Map ⇄ Tools ⇄ Settings (horizontal swipe)
  - Provide a non-intrusive page affordance (e.g., subtle dots/rail/handle) only if needed for discoverability
  - Web/desktop fallback: keyboard arrows + clickable page selector (implementation detail, not required for UX spec)

## Top bar philosophy (if present)
- No static title/header by default.
- A top bar exists only when it has strong purpose, otherwise it stays hidden.
- When shown, it should be **compact** and **contextual**, e.g.:
  - Permission/GPS state that needs attention
  - Recording/active mode indicator (measuring, placing, editing)
  - Critical session state (unsaved changes, export pending)
## Screen map (swipe pages)

### Page 1: Map (default)
- **Full-screen map canvas**
- Controls are overlays, not layout chrome
- Suggested overlay zones (workshop, not final):
  - Bottom thumb zone: primary actions (center on me, add checkpoint, measure)
  - Corners: secondary toggles (grid on/off, compass lock)
  - Context banners only when necessary (e.g., “Location permission required”)
### Page 2: Tools
- Full page dedicated to actions that would clutter the map
- Sections (workshop candidates):
  - Checkpoints: list, edit, reorder, import/export
  - Grid tools: enable/disable, snap, rotate, scale
  - Placement tools: bearing/range/offset helpers
### Page 3: Settings
- Permissions: location/camera/storage
- Preferences: units, grid defaults, map defaults
- About: version/build info
## Component inventory (starting set)
- `SwipePager` (concept): owns swipe gesture + page indexing
- `MapChrome` (concept): overlay controls for map page (no fixed header/footer)
- `TopBar` (optional, contextual): appears only when needed
- Page shells: `MapPage`, `ToolsPage`, `SettingsPage`

## Interaction principles
- **Real estate first:** map stays full screen unless the user explicitly navigates away
- **One-hand friendly:** primary actions reachable near bottom
- **Progressive disclosure:** advanced tools live on Tools page, not always-on map UI
- **Status by exception:** show status only when it needs action or context
- **Undo-friendly:** destructive actions reversible where feasible
- **Offline-first:** local persistence; explicit import/export/share actions

## Visual direction (constraints)
- Light, high-contrast UI
- Use Tailwind defaults (no custom theme yet) until we lock design tokens
- Prefer simple typography and spacing over decoration

## Workshop questions
1. What are the exact swipe pages? (Map ⇄ Tools ⇄ Settings) or (Map ⇄ List ⇄ Tools ⇄ Settings)?
2. How do we ensure swipe navigation is discoverable without adding persistent chrome?
3. Which states warrant showing the top bar (and what exactly should it show)?
4. What are the “must have in thumb zone” actions on the map page?
5. Is “Tools” a full page, or should some tools be quick overlays on the map?
# CadNav 2 — UI plan (workshop draft)

## Goals
- Faster, cleaner operator flow than CadNav
- Works well on phone first, scales to tablet/desktop
- No server dependencies; offline-first defaults
- Minimal taps, clear state, and consistent controls

## Navigation model
- **Bottom nav (primary):** Map • Tools • Settings
- **Top bar (context):** App name + current session/status (later: map name, share status, GPS state)

## Screen map (MVP shell)
- **Map**
  - Primary canvas: map + overlays
  - Quick status strip/cards: connection/session, GPS, grid mode
  - Floating action cluster (later): add checkpoint, measure, center on me
- **Tools**
  - Checkpoints: list, edit, reorder, import/export
  - Grid tools: enable/disable, snap, rotate, scale
  - Placement tools: bearing/range/offset helpers
- **Settings**
  - Permissions: location/camera/storage
  - Preferences: units, grid defaults, map defaults
  - About: version/build info

## Component inventory (starting set)
- `AppShell`: layout scaffold (top bar + routed content + bottom nav)
- `TopBar`: title + status summary
- `BottomNav`: tab navigation
- Page shells: `MapPage`, `ToolsPage`, `SettingsPage`

## Interaction principles
- **One-hand friendly:** primary actions reachable near bottom
- **Status always visible:** GPS / session / export state should be quick to find
- **Undo-friendly:** destructive actions should be reversible where feasible
- **Offline-first:** local persistence; explicit import/export/share actions

## Visual direction (constraints)
- Light, high-contrast UI
- Use Tailwind defaults (no custom theme yet) until we lock design tokens
- Prefer simple typography and spacing over decoration

## Workshop questions
1. Should the **Map** tab be “Map” or “Navigate”?
2. Do we want a **single bottom bar** or a **map-only mode** that hides chrome?
3. Is **checkpoints** primarily a list (Tools tab) or a map overlay panel?
4. What’s the minimum “session” concept for CadNav2 if there’s no server?
