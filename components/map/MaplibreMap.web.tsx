import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ThemedView } from '../themed-view';

export default function MapLibreMap() {
  const { apiKey, loading } = useMapTilerKey();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (loading || !apiKey) return;
    if (map.current) return; // stops map from initializing more than once
    if (!mapContainer.current) return;

    const mapStyle = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${apiKey}`;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [0, 0],
      zoom: 1
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [apiKey, loading]);

  if (loading || !apiKey) {
    return (
      <ThemedView style={styles.container}>
        <Text>Waiting for MapTiler API key...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
