import React, { useCallback, useEffect, FC, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Modal, Linking } from 'react-native';
import MapCanvas from '../../components/MapCanvas';
import CompassOverlay from '../components/CompassOverlay';
import { MapController, useCadNav } from '../state/CadNavContext';
import { calculateBearingDegrees } from '../utils/geo';

const openAppSettings = async () => {
  try {
    await Linking.openSettings();
  } catch {
    // Not all platforms/environments can open OS settings.
    // Avoid throwing during the location/zoom flow.
  }
};

const MapScreen: FC = () => {
  const {
    checkpoints,
    selectedCheckpointId,
    location,
    placingCheckpoint,
    grid,
    ensureLocationPermission,
    startLocation,
    centerOnMyLocation,
    cancelCheckpointPlacement,
    placeCheckpointAt,
    registerMapController,
    selectCheckpoint,
  } = useCadNav();

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);

  const mapControllerRef = useRef<MapController | null>(null);
  const pendingCenterRef = useRef(false);
  const didAutoCenterRef = useRef(false);

  const setMapRef = useCallback(
    (controller: MapController | null) => {
      mapControllerRef.current = controller;
      registerMapController(controller);
    },
    [registerMapController]
  );

  const checkPermissions = async () => {
    const granted = await ensureLocationPermission();
    setShowPermissionModal(!granted);
    if (granted) {
      await startLocation();
      pendingCenterRef.current = true;
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (didAutoCenterRef.current) return;
    if (!pendingCenterRef.current) return;
    if (!mapControllerRef.current) return;
    if (!location.coordinate) return;

    centerOnMyLocation();
    pendingCenterRef.current = false;
    didAutoCenterRef.current = true;
  }, [centerOnMyLocation, location.coordinate]);

  useEffect(() => {
    return () => registerMapController(null);
  }, [registerMapController]);

  const handlePermissionRetry = async () => {
    await checkPermissions();
  };

  const handleZoomToLocation = async () => {
    const granted = await ensureLocationPermission();
    setShowPermissionModal(!granted);
    if (!granted) return;
    await startLocation();
    pendingCenterRef.current = true;

    if (mapControllerRef.current && location.coordinate) {
      centerOnMyLocation();
      pendingCenterRef.current = false;
      didAutoCenterRef.current = true;
    }
  };

  const selectedCheckpoint =
    selectedCheckpointId ? checkpoints.find((c) => c.id === selectedCheckpointId) ?? null : null;

  const targetBearingDeg = calculateBearingDegrees(
    location.coordinate,
    selectedCheckpoint?.coordinate ?? null
  );

  return (
    <View style={styles.root}>
      <MapCanvas
        ref={setMapRef}
        checkpoints={checkpoints}
        selectedCheckpointId={selectedCheckpointId}
        userLocation={location.coordinate}
        userHeadingDeg={location.headingDeg ?? null}
        grid={grid}
        placingCheckpoint={placingCheckpoint}
        onPlaceCheckpointAt={placeCheckpointAt}
        onSelectCheckpoint={(id: string) => selectCheckpoint(id)}
      />

      {placingCheckpoint && (
        <View style={styles.placingBannerWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit placing mode"
            style={({ pressed }) => [styles.placingBanner, pressed && styles.placingBannerPressed]}
            onPress={cancelCheckpointPlacement}
          >
            <Text style={styles.placingBannerText}>Tap to exit placement mode</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zoom to my location"
        style={styles.zoomButton}
        onPress={handleZoomToLocation}
      >
        <Text style={styles.zoomButtonText}>LOC</Text>
      </Pressable>

      <CompassOverlay
        open={compassOpen}
        onToggle={() => setCompassOpen((v) => !v)}
        headingDeg={Platform.OS === 'web' ? 0 : (location.headingDeg ?? null)}
        targetBearingDeg={targetBearingDeg}
        targetLabel={selectedCheckpoint?.name ?? null}
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
  placingBannerWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  placingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,23,42,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  placingBannerPressed: {
    opacity: 0.9,
  },
  placingBannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  zoomButton: {
    position: 'absolute',
    left: 12,
    bottom: 86,
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  zoomButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.6,
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
