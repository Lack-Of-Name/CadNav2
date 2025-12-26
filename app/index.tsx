import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SwipePager, { SwipePage, SwipePagerHandle } from './components/SwipePager';
import BottomPageSelector, { BOTTOM_PAGE_SELECTOR_CLEARANCE_PX, PageSelectorItem } from './components/BottomPageSelector';
import MapScreen from './screens/MapScreen';
import ToolsScreen from './screens/ToolsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { CadNavProvider, useCadNav } from './state/CadNavContext';
import { PagerProvider } from './state/PagerContext';
import { useAppTheme } from './state/ThemeContext';

const AppContent: FC = () => {
  const { theme } = useAppTheme();
  const { mapDownload } = useCadNav();
  const [activeIndex, setActiveIndex] = useState(0);
  const pagerRef = useRef<SwipePagerHandle | null>(null);

  useEffect(() => {
    if (!mapDownload.active) return;
    // Download selection mode must be map-only.
    if (activeIndex !== 0) setActiveIndex(0);
  }, [activeIndex, mapDownload.active]);

  const goToPage = useCallback((index: number, options?: { animated?: boolean }) => {
    pagerRef.current?.goTo(index, options?.animated ?? true);
  }, []);

  const pages: SwipePage[] = [
    { key: 'map', element: <MapScreen />, swipeMode: 'edge' },
    {
      key: 'tools',
      element: (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BOTTOM_PAGE_SELECTOR_CLEARANCE_PX }]}
          showsVerticalScrollIndicator={false}
        >
          <ToolsScreen />
        </ScrollView>
      ),
    },
    {
      key: 'settings',
      element: (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BOTTOM_PAGE_SELECTOR_CLEARANCE_PX }]}
          showsVerticalScrollIndicator={false}
        >
          <SettingsScreen />
        </ScrollView>
      ),
    },
  ];

  const selectorItems: PageSelectorItem[] = useMemo(
    () => [
      { key: 'map', label: 'Map' },
      { key: 'tools', label: 'Tools' },
      { key: 'settings', label: 'Settings' },
    ],
    []
  );

  return (
    <PagerProvider goToPage={goToPage}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'right', 'bottom', 'left']}>
          <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
            <SwipePager
              ref={pagerRef}
              pages={pages}
              activeIndex={activeIndex}
              onActiveIndexChange={(next) => {
                if (mapDownload.active && next !== 0) return;
                setActiveIndex(next);
              }}
            />

            {!mapDownload.active && (
              <BottomPageSelector
                items={selectorItems}
                activeIndex={activeIndex}
                onSelectIndex={setActiveIndex}
              />
            )}
            <StatusBar style={theme.isDark ? 'light' : 'dark'} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </PagerProvider>
  );
};

const App: FC = () => {
  return (
    <CadNavProvider>
      <AppContent />
    </CadNavProvider>
  );
};

export default App;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
