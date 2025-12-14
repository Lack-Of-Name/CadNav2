import React, { FC, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SwipePager, { SwipePage } from './components/SwipePager';
import BottomPageSelector, { PageSelectorItem } from './components/BottomPageSelector';
import MapScreen from './screens/MapScreen';
import ToolsScreen from './screens/ToolsScreen';
import SettingsScreen from './screens/SettingsScreen';

const App: FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const pages: SwipePage[] = [
    { key: 'map', element: <MapScreen />, swipeMode: 'edge' },
    { key: 'tools', element: <ToolsScreen /> },
    { key: 'settings', element: <SettingsScreen /> },
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
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
        <View style={styles.root}>
          <SwipePager pages={pages} activeIndex={activeIndex} onActiveIndexChange={setActiveIndex} />
          <BottomPageSelector items={selectorItems} activeIndex={activeIndex} onSelectIndex={setActiveIndex} />
          <StatusBar style="dark" />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
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
});
