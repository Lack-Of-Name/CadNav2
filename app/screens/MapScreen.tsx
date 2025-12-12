import React, { useEffect, useRef, FC } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

let MapView: typeof import('react-native-maps').default | null = null;
let MapContainer: any;
let TileLayer: any;

if (Platform.OS === 'web') {
  const leaflet = require('react-leaflet');
  MapContainer = leaflet.MapContainer;
  TileLayer = leaflet.TileLayer;
} else {
  MapView = require('react-native-maps').default;
}

function useLeafletCss() {
  const addedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || addedRef.current) return;

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

const MapScreen: FC = () => {
  useLeafletCss();

  return (
    <View style={styles.root}>
      {Platform.OS === 'web' ? (
        <View style={styles.mapCanvas}>
          <MapContainer
            center={[51.5074, -0.1278]}
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
      ) : (
        MapView && (
          <MapView
            style={styles.mapNative}
            initialRegion={{
              latitude: 51.5074,
              longitude: -0.1278,
              latitudeDelta: 0.09,
              longitudeDelta: 0.09
            }}
            rotateEnabled
            pitchEnabled
          />
        )
      )}

      <View style={styles.leftPill} pointerEvents="none">
        <Text style={styles.pillTitle}>Map</Text>
        <Text style={styles.pillText}>
          {Platform.OS === 'web' ? 'OSM • Pan/zoom enabled' : 'Offline • GPS: unknown'}
        </Text>
      </View>

      <View style={styles.rightStack} pointerEvents="none">
        <View style={styles.rightPill}>
          <Text style={styles.pillText}>Grid: Off</Text>
        </View>
        <View style={styles.rightPill}>
          <Text style={styles.pillText}>Compass: Free</Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.actionBar}>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionText}>Center</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionText}>Add CP</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionText}>Measure</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default MapScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  mapCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc'
  },
  mapNative: {
    ...StyleSheet.absoluteFillObject
  },
  leftPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rightStack: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8
  },
  rightPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pillTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  pillText: {
    marginTop: 2,
    fontSize: 12,
    color: '#334155'
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    paddingHorizontal: 16
  },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 8,
    maxWidth: 420,
    width: '100%'
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  }
});
