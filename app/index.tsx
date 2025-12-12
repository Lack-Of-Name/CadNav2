import React, { FC, ReactElement } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SwipePager, { SwipePage } from './components/SwipePager';
import MapScreen from './screens/MapScreen';
import ToolsScreen from './screens/ToolsScreen';
import SettingsScreen from './screens/SettingsScreen';

const App: FC = () => {
  const pages: SwipePage[] = [
    { key: 'map', element: <MapScreen />, swipeMode: 'edge' },
    { key: 'tools', element: <ToolsScreen /> },
    { key: 'settings', element: <SettingsScreen /> },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
        <View style={styles.root}>
          <SwipePager pages={pages} />
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
