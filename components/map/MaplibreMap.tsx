import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { Camera, MapView } from "@maplibre/maplibre-react-native";
import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ThemedView } from '../themed-view';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();

  if (loading || !apiKey) {
    return (
      <ThemedView style={styles.page}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Waiting for MapTiler API key...</Text>
      </ThemedView>
    );
  }

  const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

  return (
    <ThemedView style={styles.page}>
      <MapView
        style={styles.map}
        mapStyle={mapStyle}
        logoEnabled={false}
      >
        <Camera
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
        />
      </MapView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  map: {
    flex: 1,
    alignSelf: 'stretch',
  },
});
