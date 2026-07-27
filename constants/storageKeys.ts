/**
 * AsyncStorage keys used across the app.
 *
 * Two route stores exist on purpose:
 * - WORKSPACE_ROUTES: editable route cards on the Routes tab (title, icon, color, checkpoints).
 * - SAVED_ROUTES: named routes in the library (Save / Saved when adding points).
 *
 * Do not merge these keys without a migration — users may have data under both.
 */

/** Routes tab workspace (legacy key name kept for existing installs). */
export const WORKSPACE_ROUTES = 'APP_ROUTES';

/** Saved route library (`{ routes: SavedRoute[] }`). */
export const SAVED_ROUTES = 'cadnav2.routes.v1';

/** Saved single locations (`{ locations: SavedLocation[] }`). */
export const SAVED_LOCATIONS = 'cadnav2.locations.v1';

/** Legacy active-checkpoint blob; migrated once into SAVED_ROUTES. */
export const LEGACY_CHECKPOINTS = 'cadnav2.checkpoints.v1';

/** App settings registry (`hooks/settings.tsx`). */
export const SETTINGS = 'cadnav2.settings.v1';

/** MapTiler API key (`components/map/MapTilerKeyProvider.tsx`). */
export const MAPTILER_API_KEY = 'MAPTILER_API_KEY';

/** Timestamp (ms) of the very first app open, used for the 24h bundled-key trial. */
export const FIRST_OPEN_TIME = 'cadnav2.firstOpenTime.v1';

/** Tutorial completion state (`hooks/tutorials.tsx`). Array of tutorial IDs. */
export const TUTORIALS_COMPLETED = 'cadnav2.tutorials.completed.v1';
