import { Camera, MapView } from "@maplibre/maplibre-react-native";
import React from 'react';
import { StyleSheet } from 'react-native';
import { ThemedView } from '../themed-view';

const mapStyle = "https://api.maptiler.com/maps/outdoor-v4/style.json?key=";

export default function MapLibreMap() {
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
