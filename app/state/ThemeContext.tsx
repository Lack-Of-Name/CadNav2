import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Theme as NavigationTheme } from '@react-navigation/native';

export type AppThemeId = 'light' | 'dark' | 'retroLight' | 'retroDark';

export type AppThemeColors = {
  background: string;
  surface: string;
  surfacePressed: string;
  border: string;

  text: string;
  textMuted: string;
  textSubtle: string;

  primary: string;
  primaryPressed: string;
  onPrimary: string;
  onPrimaryMuted: string;

  success: string;
  danger: string;

  overlay: string;
  onOverlay: string;

  selection: string;
  tick: string;
  tickStrong: string;
};

export type AppTheme = {
  id: AppThemeId;
  name: string;
  isDark: boolean;
  colors: AppThemeColors;
  navigationTheme: NavigationTheme;
};

type ThemeContextValue = {
  theme: AppTheme;
  themeId: AppThemeId;
  setThemeId: (id: AppThemeId) => void;
};

const THEME_STORAGE_KEY = 'cadnav2.themeId';

const makeNavigationTheme = (t: AppThemeColors, isDark: boolean): NavigationTheme => {
  return {
    dark: isDark,
    colors: {
      primary: t.primary,
      background: t.background,
      card: t.surface,
      text: t.text,
      border: t.border,
      notification: t.primary,
    },
    fonts: {
      regular: { fontFamily: undefined, fontWeight: '400' },
      medium: { fontFamily: undefined, fontWeight: '500' },
      bold: { fontFamily: undefined, fontWeight: '700' },
      heavy: { fontFamily: undefined, fontWeight: '800' },
    },
  };
};

const withNav = (id: AppThemeId, name: string, isDark: boolean, colors: AppThemeColors): AppTheme => {
  return {
    id,
    name,
    isDark,
    colors,
    navigationTheme: makeNavigationTheme(colors, isDark),
  };
};

const lightTheme = withNav('light', 'Light', false, {
  background: '#ffffff',
  surface: '#f8fafc',
  surfacePressed: '#f1f5f9',
  border: '#e2e8f0',

  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#64748b',

  primary: '#0f172a',
  primaryPressed: '#0f172a',
  onPrimary: '#ffffff',
  onPrimaryMuted: 'rgba(255,255,255,0.8)',

  success: '#16a34a',
  danger: '#dc2626',

  overlay: 'rgba(15,23,42,0.92)',
  onOverlay: '#ffffff',

  selection: 'rgba(15,23,42,0.06)',
  tick: '#94a3b8',
  tickStrong: '#64748b',
});

const darkTheme = withNav('dark', 'Dark', true, {
  background: '#0f172a',
  surface: 'rgba(255,255,255,0.12)',
  surfacePressed: 'rgba(255,255,255,0.18)',
  border: 'rgba(255,255,255,0.22)',

  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.8)',
  textSubtle: '#94a3b8',

  primary: '#ffffff',
  primaryPressed: '#ffffff',
  onPrimary: '#0f172a',
  onPrimaryMuted: 'rgba(15,23,42,0.8)',

  success: '#16a34a',
  danger: '#dc2626',

  overlay: 'rgba(15,23,42,0.92)',
  onOverlay: '#ffffff',

  selection: 'rgba(255,255,255,0.14)',
  tick: '#94a3b8',
  tickStrong: '#ffffff',
});

// Retro accent palette (highlights)
const RETRO_TEAL = '#3F8A8C';
const RETRO_BLUE = '#0C5679';
const RETRO_ORANGE = '#F28A0F';
const RETRO_RED = '#E5340B';

const retroLightTheme = withNav('retroLight', 'Retro Light', false, {
  ...lightTheme.colors,
  primary: RETRO_TEAL,
  primaryPressed: RETRO_BLUE,
  success: RETRO_ORANGE,
  danger: RETRO_RED,
});

const retroDarkTheme = withNav('retroDark', 'Retro Dark', true, {
  ...darkTheme.colors,
  primary: RETRO_TEAL,
  primaryPressed: RETRO_BLUE,
  success: RETRO_ORANGE,
  danger: RETRO_RED,
});

const THEMES: Record<AppThemeId, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
  retroLight: retroLightTheme,
  retroDark: retroDarkTheme,
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const AppThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const colorScheme = useColorScheme();
  const defaultThemeId: AppThemeId = colorScheme === 'dark' ? 'dark' : 'light';

  const [themeId, setThemeIdState] = useState<AppThemeId>(defaultThemeId);
  const theme = THEMES[themeId] ?? THEMES[defaultThemeId];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark' || stored === 'retroLight' || stored === 'retroDark') {
          setThemeIdState(stored);
        }
      } catch {
        // Non-fatal; fall back to default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeId = useCallback((next: AppThemeId) => {
    setThemeIdState(next);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {
      // ignore
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, themeId, setThemeId }), [theme, themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within AppThemeProvider');
  return ctx;
};
