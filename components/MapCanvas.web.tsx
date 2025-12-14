import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const leaflet = require('react-leaflet');
const MapContainer = leaflet.MapContainer;
const TileLayer = leaflet.TileLayer;

function useLeafletCss() {
  const addedRef = useRef(false);

  useEffect(() => {
    if (addedRef.current) return;

    const id = 'leaflet-css';
    if (document.getElementById(id)) {
      addedRef.current = true;
      return;
    }

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.crossOrigin = '';
    document.head.appendChild(link);

    addedRef.current = true;
  }, []);
}

export default function MapCanvas() {
  useLeafletCss();

  return (
    <View style={styles.root}>
      <MapContainer
        center={[-36.9962, 145.0272]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc',
  },
});
