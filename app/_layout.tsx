import { ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';

import { AppThemeProvider, useAppTheme } from './state/ThemeContext';

function LayoutInner() {
  const { theme } = useAppTheme();

  return (
    <ThemeProvider value={theme.navigationTheme}>
      <Slot />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <LayoutInner />
    </AppThemeProvider>
  );
}
