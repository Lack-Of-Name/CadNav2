/**
 * CadNav Material Design colour system.
 * Strict palette: ~10 semantic colours, 4 neutral grays.
 * Never import raw hex elsewhere — use these tokens.
 */

import { Platform } from 'react-native';

// ── Brand ──────────────────────────────────────────────────────────────────
const PRIMARY       = '#1A73E8'; // Google Blue — primary actions, tint
const PRIMARY_DARK  = '#4A9EFF'; // Lighter blue for dark-mode tint
const SECONDARY     = '#34A853'; // Success / active route green
const ACCENT_PURPLE = '#AF52DE'; // Optional accent (used in UI)
const ACCENT_ORANGE = '#FF9500'; // Optional accent
const TEMP_TARGET    = '#F6B23C'; // Temporary checkpoint / navigation target

// ── Semantic status ────────────────────────────────────────────────────────
const SUCCESS       = '#34A853';
const WARNING       = '#FBBC04';
const ERROR         = '#EA4335';

// ── Neutrals (light) ──────────────────────────────────────────────────────
const SURFACE_L     = '#FFFFFF'; // Card / modal background
const BG_L          = '#F8F9FA'; // Page background
const DIVIDER_L     = '#DADCE0'; // Borders, separators
const TEXT_L        = '#202124'; // Primary text
const TEXT_MUTED_L  = '#5F6368'; // Secondary / muted text
const TEXT_SUBTLE_L = '#9AA0A6'; // Placeholder / hint

// ── Neutrals (dark) ───────────────────────────────────────────────────────
const SURFACE_D     = '#1E1E2E'; // Card / modal background
const BG_D          = '#12121A'; // Page background
const DIVIDER_D     = '#2D2D3D'; // Borders, separators
const TEXT_D        = '#E8EAED'; // Primary text
const TEXT_MUTED_D  = '#9AA0A6'; // Secondary / muted text
const TEXT_SUBTLE_D = '#5F6368'; // Placeholder / hint

// ── HUD overlay (always dark) ─────────────────────────────────────────────
export const HUD = {
  bg:          '#0D0D1A',
  border:      '#1E1E3A',
  text:        '#E8EAED',
  textMuted:   '#9AA0A6',
  textSubtle:  '#4A4A6A',
  tick:        '#3A3A5A',
  tickStrong:  '#6A6A9A',
  accent:      PRIMARY_DARK,
};

export const Colors = {
  light: {
    primary:        PRIMARY,
    secondary:      SECONDARY,
    tempTarget:     TEMP_TARGET,
    accentPurple:   ACCENT_PURPLE,
    accentOrange:   ACCENT_ORANGE,
    success:        SUCCESS,
    warning:        WARNING,
    error:          ERROR,
    text:           TEXT_L,
    textMuted:      TEXT_MUTED_L,
    textSubtle:     TEXT_SUBTLE_L,
    background:     BG_L,
    surface:        SURFACE_L,
    divider:        DIVIDER_L,
    tint:           PRIMARY,
    icon:           TEXT_MUTED_L,
    tabIconDefault: TEXT_MUTED_L,
    tabIconSelected:PRIMARY,
  },
  dark: {
    primary:        PRIMARY_DARK,
    secondary:      SECONDARY,
    tempTarget:     TEMP_TARGET,
    accentPurple:   ACCENT_PURPLE,
    accentOrange:   ACCENT_ORANGE,
    success:        SUCCESS,
    warning:        WARNING,
    error:          ERROR,
    text:           TEXT_D,
    textMuted:      TEXT_MUTED_D,
    textSubtle:     TEXT_SUBTLE_D,
    background:     BG_D,
    surface:        SURFACE_D,
    divider:        DIVIDER_D,
    tint:           PRIMARY_DARK,
    icon:           TEXT_MUTED_D,
    tabIconDefault: TEXT_MUTED_D,
    tabIconSelected:PRIMARY_DARK,
  },
} as const;

export type ColorScheme = 'light' | 'dark';
export type ColorToken = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono:    "SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
});

/** Elevation shadows — use sparingly, only for floating surfaces */
export const Elevation = {
  none:   {},
  low:    { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,  elevation: 2 },
  medium: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6,  elevation: 4 },
  high:   { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 8 },
};

/** 8pt baseline grid spacing */
export const Space = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

/** Border radii */
export const Radius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  full: 999,
} as const;
