/**
 * CadNav hiking-gear colour system.
 * Woodland / olive field palette inspired by cadet kit and US woodland camo.
 * Never import raw hex elsewhere — use these tokens.
 */

import { Platform } from 'react-native';

// ── Brand (olive drab & trail accents) ─────────────────────────────────────
const PRIMARY       = '#4A5D23'; // Olive drab — primary actions, tint
const PRIMARY_DARK  = '#8FA84E'; // Lighter olive for dark-mode tint
const SECONDARY     = '#5C6B3C'; // Moss green — active route / success
const ACCENT_PURPLE = '#7A6B5A'; // Coyote tan accent (replaces purple)
const ACCENT_ORANGE = '#C47A2C'; // Trail marker / warning accent
const TEMP_TARGET    = '#E8A43C'; // Temporary checkpoint / navigation target

// ── Semantic status ────────────────────────────────────────────────────────
const SUCCESS       = '#5C7A3A';
const WARNING       = '#D4A017';
const ERROR         = '#B54A3C';

// ── Neutrals (light — khaki parchment) ─────────────────────────────────────
const SURFACE_L     = '#FAF8F2'; // Card / modal background
const BG_L          = '#F2EFE6'; // Page background
const DIVIDER_L     = '#C4BAA8'; // Borders, separators
const TEXT_L        = '#1F2418'; // Primary text
const TEXT_MUTED_L  = '#5C5748'; // Secondary / muted text
const TEXT_SUBTLE_L = '#8A8474'; // Placeholder / hint

// ── Neutrals (dark — night field) ──────────────────────────────────────────
const SURFACE_D     = '#1E231A'; // Card / modal background
const BG_D          = '#141810'; // Page background
const DIVIDER_D     = '#3A4230'; // Borders, separators
const TEXT_D        = '#E8E6DF'; // Primary text
const TEXT_MUTED_D  = '#A8A494'; // Secondary / muted text
const TEXT_SUBTLE_D = '#6B675C'; // Placeholder / hint

// ── HUD overlay (always dark field kit) ─────────────────────────────────────
export const HUD = {
  bg:          '#0F120C',
  border:      '#2A3220',
  text:        '#E8E6DF',
  textMuted:   '#A8A494',
  textSubtle:  '#5C5748',
  tick:        '#3A4230',
  tickStrong:  '#6B7C4E',
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

/** Border radii — tactical, mostly square */
export const Radius = {
  sm:   2,
  md:   4,
  lg:   6,
  xl:   8,
  full: 999,
} as const;
