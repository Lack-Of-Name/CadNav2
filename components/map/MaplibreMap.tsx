import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { useGPS } from '@/hooks/gps';
import { Camera, MapView, UserLocation } from "@maplibre/maplibre-react-native";
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ThemedView } from '../themed-view';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const { lastLocation, setLastLocation } = useGPS();

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
        {/* UserLocation is rendered natively here to avoid duplicate native view registration. */}
        {/* @ts-ignore */}
        <UserLocation
          showsUserHeadingIndicator={true}
          onUpdate={(e: any) => {
            try {
              const { coords, timestamp } = e.nativeEvent;
              const loc = {
                coords: {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracy: coords.accuracy,
                },
                timestamp: timestamp ?? Date.now(),
              } as const;
              setLastLocation(loc as any);
            } catch (err) {
              // ignore
            }
          }}
        />
      </MapView>

      {lastLocation ? (
        <View style={styles.locationOverlay}>
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
