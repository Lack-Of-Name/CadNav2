import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import SwipePager from './src/components/SwipePager';
import MapScreen from './src/screens/MapScreen';
import ToolsScreen from './src/screens/ToolsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <SwipePager
          pages={[
            { key: 'map', element: <MapScreen />, swipeMode: 'edge' },
            { key: 'tools', element: <ToolsScreen /> },
            { key: 'settings', element: <SettingsScreen /> }
          ]}
        />
        <StatusBar style="dark" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  root: {
    flex: 1,
    backgroundColor: '#ffffff'
  }
});
