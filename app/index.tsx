import React, { FC, useCallback, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SwipePager, { SwipePage, SwipePagerHandle } from './components/SwipePager';
import BottomPageSelector, { PageSelectorItem } from './components/BottomPageSelector';
import MapScreen from './screens/MapScreen';
import ToolsScreen from './screens/ToolsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { CadNavProvider } from './state/CadNavContext';
import { PagerProvider } from './state/PagerContext';

const App: FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const pagerRef = useRef<SwipePagerHandle | null>(null);

  const goToPage = useCallback((index: number, options?: { animated?: boolean }) => {
    pagerRef.current?.goTo(index, options?.animated ?? true);
  }, []);

  const pages: SwipePage[] = [
    { key: 'map', element: <MapScreen />, swipeMode: 'edge' },
    {
      key: 'tools',
      element: (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ToolsScreen />
        </ScrollView>
      ),
    },
    {
      key: 'settings',
      element: (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
    <CadNavProvider>
      <PagerProvider goToPage={goToPage}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
            <View style={styles.root}>
              <SwipePager ref={pagerRef} pages={pages} activeIndex={activeIndex} onActiveIndexChange={setActiveIndex} />
              <BottomPageSelector items={selectorItems} activeIndex={activeIndex} onSelectIndex={setActiveIndex} />
              <StatusBar style="dark" />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </PagerProvider>
    </CadNavProvider>
  );
};

export default App;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
  },
});
