/**
 * Shared domain types. Hooks may re-export these for backward compatibility.
 */

export type Checkpoint = {
  id: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  label?: string;
  color?: string;
  elevation?: number;
  /** MGRS grid reference the checkpoint was entered with (e.g. "55H DV 123 456"). */
  mgrs?: string;
};

/** Named route in the saved library (Routes tab → Save, map → Saved). */
export type SavedRoute = {
  id: string;
  name: string;
  createdAt: number;
  checkpoints: Checkpoint[];
  isLoop?: boolean;
};

export type SavedLocation = {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  createdAt: number;
};

/** Route card on the Routes tab workspace (persisted under WORKSPACE_ROUTES). */
export type WorkspaceRoute = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  checkpoints?: Checkpoint[];
  isLoop?: boolean;
};

/** @deprecated Prefer WorkspaceRoute — kept for existing imports. */
export type RouteItem = WorkspaceRoute;
