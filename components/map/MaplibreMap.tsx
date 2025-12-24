import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { useGPS } from '@/hooks/gps';
import { Camera, MapView, UserLocation } from "@maplibre/maplibre-react-native";
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../themed-view';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const { lastLocation } = useGPS();
  const insets = useSafeAreaInsets();

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
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
      >
        <Camera
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 1,
          }}
        />
        {/* Render the native location puck w/ heading indicator. */}
        {/* @ts-ignore - typing differs across forks */}
        <UserLocation
          visible={true}
          animated={true}
          renderMode="native"
          androidRenderMode="compass"
          showsUserHeadingIndicator={true}
          androidPreferredFramesPerSecond={60}
        />
      </MapView>

      {lastLocation ? (
        <View
          style={[
            styles.locationOverlay,
            {
              top: insets.top + 12,
              right: insets.right + 12,
            },
          ]}
        >
          <Text style={styles.locationText}>Lat: {lastLocation.coords.latitude.toFixed(6)}</Text>
          <Text style={styles.locationText}>Lon: {lastLocation.coords.longitude.toFixed(6)}</Text>
        </View>
      ) : null}
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
  locationOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 6,
  },
  locationText: {
    color: 'white',
    fontSize: 12,
  },
});
