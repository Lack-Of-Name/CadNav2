import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { ThemedView } from '../themed-view';

const mapStyle = "https://api.maptiler.com/maps/outdoor-v4/style.json?key=9Zsr687Ti9MQB0HTAUQo";

export default function MapLibreMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (map.current) return; // stops map from initializing more than once
    if (!mapContainer.current) return;

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
  }, []);

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
