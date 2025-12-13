import React, { useEffect, useRef, FC, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Modal, Linking } from 'react-native';
import * as Location from 'expo-location';

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

const openAppSettings = () => {
  Linking.openSettings();
};

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

async function locationPermissionsEnabled() {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }
  return true;
}

const MapScreen: FC = () => {
  useLeafletCss();

  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const checkPermissions = async () => {
    const granted = await locationPermissionsEnabled();
    setLocationGranted(granted);
    setShowPermissionModal(!granted);
    console.log('Location permission granted:', granted);
  };

  

  useEffect(() => {
    checkPermissions();
  }, []);

  const handlePermissionRetry = async () => {
    await checkPermissions();
  };

  return (
    <View style={styles.root}>
      {Platform.OS === 'web' ? (
        <View style={styles.mapCanvas}>
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
      ) : (
        MapView && (
          <MapView
            style={styles.mapNative}
            initialRegion={{
              latitude: -36.9962,
              longitude: 145.0272,
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

      <Modal
        visible={showPermissionModal}
        transparent
        animationType="fade"
        onRequestClose={handlePermissionRetry}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalText, {fontSize: 18}]} >Location is not granted.</Text>
             <Text style={[styles.modalText, {color: 'blue', textDecorationLine: "underline"}]} onPress={openAppSettings}>
              Open Settings
            </Text>
            <Pressable style={styles.modalButton} onPress={handlePermissionRetry}>
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContent: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 12,
    minWidth: 260,
    alignItems: 'center'
  },
  modalText: {
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center'
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0f172a'
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  }
});
