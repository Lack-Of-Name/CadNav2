import React, { useEffect, FC, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Modal, Linking } from 'react-native';
import * as Location from 'expo-location';
import MapCanvas from '../../components/MapCanvas';
import CompassOverlay from '../components/CompassOverlay';

const openAppSettings = () => {
  Linking.openSettings();
};

async function locationPermissionsEnabled() {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }
  return true;
}

const MapScreen: FC = () => {
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);

  const checkPermissions = async () => {
    const granted = await locationPermissionsEnabled();
    setShowPermissionModal(!granted);
  };

  

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (!compassOpen) return;
    if (Platform.OS === 'web') return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        subscription = await Location.watchHeadingAsync((event) => {
          if (cancelled) return;
          const next =
            (typeof event.trueHeading === 'number' && event.trueHeading >= 0)
              ? event.trueHeading
              : event.magHeading;
          if (typeof next === 'number') setHeadingDeg(next);
        });
      } catch {
        // no-op: heading isn't available on all devices/sims
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [compassOpen]);

  const handlePermissionRetry = async () => {
    await checkPermissions();
  };

  return (
    <View style={styles.root}>
      <MapCanvas />

      <CompassOverlay
        open={compassOpen}
        onToggle={() => setCompassOpen((v) => !v)}
        headingDeg={Platform.OS === 'web' ? 0 : headingDeg}
        targetLabel={null}
      />

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
