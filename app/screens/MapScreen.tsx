import React, { useCallback, useEffect, FC, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Modal, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapCanvas from '../../components/MapCanvas';
import CompassOverlay from '../components/CompassOverlay';
import { MapController, useCadNav } from '../state/CadNavContext';
import { calculateBearingDegrees } from '../utils/geo';
import { normalizeBoundsFromCorners } from '../utils/offlineTiles';

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
    mapDownload,
    offlineMapMode,
    baseMap,
    offlineTiles,
    ensureLocationPermission,
    startLocation,
    centerOnMyLocation,
    cancelCheckpointPlacement,
    placeCheckpointAt,
    registerMapController,
    getMapInitialCenter,
    setLastMapCenter,
    selectCheckpoint,
    exitMapDownloadMode,
    registerMapDownloadTap,
    resetMapDownloadSelection,
    saveMapDownloadSelection,
    downloadOfflineTilesForBounds,
    setBaseMap,
  } = useCadNav();

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);

  const mapControllerRef = useRef<MapController | null>(null);
  const pendingCenterRef = useRef(false);

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
    if (!pendingCenterRef.current) return;
    if (!mapControllerRef.current) return;
    if (!location.coordinate) return;

    centerOnMyLocation();
    pendingCenterRef.current = false;
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
    }
  };

  const selectedCheckpoint =
    selectedCheckpointId ? checkpoints.find((c) => c.id === selectedCheckpointId) ?? null : null;

  const targetBearingDeg = calculateBearingDegrees(
    location.coordinate,
    selectedCheckpoint?.coordinate ?? null
  );

  const downloadStepText = (() => {
    if (offlineTiles.status === 'downloading') {
      return `Downloading maps: ${offlineTiles.completed}/${offlineTiles.total}${offlineTiles.failed ? ` (failed ${offlineTiles.failed})` : ''}`;
    }
    if (offlineTiles.status === 'error') {
      return offlineTiles.error ?? 'Download error';
    }
    if (!mapDownload.active) return null;
    if (!mapDownload.firstCorner) return 'Tap the TOP-LEFT corner of the area';
    if (!mapDownload.secondCorner) return 'Tap the BOTTOM-RIGHT corner of the area';
    const label = baseMap === 'esriWorldImagery' ? 'Esri imagery' : 'OSM';
    return `Area selected. Press SAVE to download ${label}.`;
  })();

  const canSaveDownload =
    mapDownload.active && !!mapDownload.firstCorner && !!mapDownload.secondCorner;

  const showDownloadProgressBanner = offlineTiles.status === 'downloading' || offlineTiles.status === 'error';
  const downloadProgressText =
    offlineTiles.status === 'downloading'
      ? `Downloading maps: ${offlineTiles.completed}/${offlineTiles.total}${offlineTiles.failed ? ` (failed ${offlineTiles.failed})` : ''}`
      : offlineTiles.status === 'error'
        ? (offlineTiles.error ?? 'Download error')
        : null;

  return (
    <View style={styles.root}>
      <MapCanvas
        ref={setMapRef}
        checkpoints={checkpoints}
        selectedCheckpointId={selectedCheckpointId}
        userLocation={location.coordinate}
        userHeadingDeg={location.headingDeg ?? null}
        grid={grid}
        offlineMapMode={offlineMapMode}
        baseMap={baseMap}
        initialCenter={getMapInitialCenter()}
        onCenterChange={setLastMapCenter}
        minZoomLevel={offlineTiles.minZoom}
        maxZoomLevel={offlineTiles.maxZoom}
        offlineTileTemplateUri={`${offlineTiles.rootUri}{z}/{x}/{y}.png`}
        mapDownload={mapDownload}
        onMapTap={(coord) => {
          if (!mapDownload.active) return;
          registerMapDownloadTap(coord);
        }}
        placingCheckpoint={placingCheckpoint && !mapDownload.active}
        onPlaceCheckpointAt={mapDownload.active ? undefined : placeCheckpointAt}
        onSelectCheckpoint={(id: string) => selectCheckpoint(id)}
      />

      {mapDownload.active && (
        <View style={styles.downloadOverlay} pointerEvents="box-none">
          <View style={styles.downloadActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save map download selection"
              disabled={!canSaveDownload}
              style={({ pressed }) => [
                styles.downloadSave,
                (!canSaveDownload || pressed) && styles.downloadSavePressed,
              ]}
              onPress={async () => {
                if (!mapDownload.firstCorner || !mapDownload.secondCorner) return;
                const bounds = normalizeBoundsFromCorners(mapDownload.firstCorner, mapDownload.secondCorner);
                saveMapDownloadSelection();
                void downloadOfflineTilesForBounds(bounds);
              }}
            >
              <Text style={styles.downloadActionText}>SAVE</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset selection"
              style={({ pressed }) => [styles.downloadReset, pressed && styles.downloadResetPressed]}
              onPress={resetMapDownloadSelection}
            >
              <MaterialIcons name="redo" size={18} color="#ffffff" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle download map style"
              style={({ pressed }) => [styles.downloadReset, pressed && styles.downloadResetPressed]}
              onPress={() => setBaseMap(baseMap === 'esriWorldImagery' ? 'osm' : 'esriWorldImagery')}
            >
              <MaterialIcons name="map" size={18} color="#ffffff" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel map download selection"
              style={({ pressed }) => [styles.downloadCancel, pressed && styles.downloadCancelPressed]}
              onPress={exitMapDownloadMode}
            >
              <Text style={styles.downloadActionText}>CANCEL</Text>
            </Pressable>
          </View>

          <View style={styles.downloadInfo}>
            <Text style={styles.downloadInfoText}>{downloadStepText}</Text>
          </View>
        </View>
      )}

      {!mapDownload.active && showDownloadProgressBanner && !!downloadProgressText && (
        <View style={styles.progressBannerWrap} pointerEvents="none">
          <View style={styles.progressBanner}>
            <Text style={styles.progressBannerText}>{downloadProgressText}</Text>
          </View>
        </View>
      )}

      {placingCheckpoint && !mapDownload.active && (
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

      {!mapDownload.active && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom to my location"
          style={styles.zoomButton}
          onPress={handleZoomToLocation}
        >
          <Text style={styles.zoomButtonText}>LOC</Text>
        </Pressable>
      )}

      {!mapDownload.active && (
        <CompassOverlay
          open={compassOpen}
          onToggle={() => setCompassOpen((v) => !v)}
          headingDeg={Platform.OS === 'web' ? 0 : (location.headingDeg ?? null)}
          targetBearingDeg={targetBearingDeg}
          targetLabel={selectedCheckpoint?.name ?? null}
        />
      )}

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
  downloadOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },
  downloadActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  downloadSave: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
  },
  downloadSavePressed: {
    opacity: 0.85,
  },
  downloadCancel: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  downloadCancelPressed: {
    opacity: 0.85,
  },
  downloadReset: {
    width: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  downloadResetPressed: {
    opacity: 0.85,
  },
  downloadActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  downloadInfo: {
    marginTop: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  downloadInfoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  progressBannerWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressBanner: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  progressBannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
