import { alert as showAlert } from '@/components/alert';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useGPS } from '@/hooks/gps';
import { formatBytes, useOfflineMaps, ZOOM_PRESETS, type DownloadTarget, type ZoomPreset } from '@/hooks/offline-maps';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const isWeb = Platform.OS === 'web';

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];
const DEFAULT_RADIUS_KM = 15;

type LocationMode = 'my-location' | 'coordinates';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function DownloadMapsModal({ visible, onClose }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const rowBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const separatorColor = useThemeColor({ light: '#e5e5ea', dark: '#38383a' }, 'icon');
  const sectionHeaderColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'text');
  const { apiKey } = useMapTilerKey();
  const { lastLocation, requestLocation } = useGPS();
  const { packs, loadingPacks, loadPacks, deletePack, activeDownload, startDownload } = useOfflineMaps();

  const [panel, setPanel] = useState<'main' | 'download'>('main');
  const [locationMode, setLocationMode] = useState<LocationMode>('my-location');
  const [customLat, setCustomLat] = useState('');
  const [customLon, setCustomLon] = useState('');
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);

  useEffect(() => {
    if (visible && !isWeb) {
      void loadPacks();
    }
    if (visible) {
      setPanel('main');
    }
  }, [visible, loadPacks]);

  const buildTarget = useCallback((): DownloadTarget | null => {
    if (locationMode === 'my-location') {
      if (!lastLocation) {
        requestLocation();
        void showAlert({ title: 'Offline Maps', message: 'Waiting for GPS fix. Please try again in a moment.' });
        return null;
      }
      return {
        latitude: lastLocation.coords.latitude,
        longitude: lastLocation.coords.longitude,
        label: 'My location',
        radiusKm,
      };
    }

    // Custom coordinates
    const lat = parseFloat(customLat.trim());
    const lon = parseFloat(customLon.trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      void showAlert({ title: 'Invalid Coordinates', message: 'Enter valid latitude (-90 to 90) and longitude (-180 to 180).' });
      return null;
    }
    return {
      latitude: lat,
      longitude: lon,
      label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      radiusKm,
    };
  }, [locationMode, lastLocation, requestLocation, customLat, customLon, radiusKm]);

  const handleDownload = useCallback(
    async (preset: ZoomPreset) => {
      if (!apiKey) {
        void showAlert({ title: 'Offline Maps', message: 'Please set your MapTiler API key first.' });
        return;
      }
      const target = buildTarget();
      if (!target) return;
      await startDownload(preset, target, apiKey);
      setPanel('main');
    },
    [apiKey, buildTarget, startDownload],
  );

  const locationSummary =
    locationMode === 'my-location'
      ? lastLocation
        ? `${lastLocation.coords.latitude.toFixed(4)}, ${lastLocation.coords.longitude.toFixed(4)}`
        : 'Awaiting GPS…'
      : customLat && customLon
        ? `${customLat}, ${customLon}`
        : 'Enter coordinates';

  // ---------- Render ----------
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <ThemedView style={[styles.container, { backgroundColor: String(background), borderColor: String(borderColor) }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            {panel !== 'main' ? (
              <TouchableOpacity
                onPress={() => setPanel('main')}
                style={[styles.headerButton, { borderColor: String(borderColor), backgroundColor: String(rowBg) }]}
              >
                <ThemedText style={styles.headerButtonText}>Back</ThemedText>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 64 }} />
            )}
            <ThemedText type="subtitle">Offline Maps</ThemedText>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.headerButton, { borderColor: String(borderColor), backgroundColor: String(rowBg) }]}
            >
              <ThemedText style={styles.headerButtonText}>Close</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* ========== WEB: Disabled state ========== */}
            {isWeb && (
              <View style={styles.webDisabledContainer}>
                <View style={styles.webIconWrap}>
                  <IconSymbol name="icloud.and.arrow.down" size={48} color={Colors[colorScheme].tabIconDefault} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.webTitle}>
                  Not available on web
                </ThemedText>
                <ThemedText style={styles.webBody}>
                  Downloading maps for offline use requires the native app.{'\n'}
                  Get the app to take your maps into the field.
                </ThemedText>

                {/* Greyed-out preview */}
                <View style={styles.webPreviewSection} pointerEvents="none">
                  <ThemedText style={[styles.sectionLabel, { color: sectionHeaderColor, opacity: 0.5 }]}>
                    DOWNLOAD AREA
                  </ThemedText>
                  {ZOOM_PRESETS.map((preset) => (
                    <View
                      key={preset.label}
                      style={[styles.presetRow, { backgroundColor: rowBg, borderColor: separatorColor, opacity: 0.35 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold">{preset.label}</ThemedText>
                        <ThemedText style={styles.presetDesc}>{preset.description}</ThemedText>
                      </View>
                      <View style={[styles.downloadBtnCircle, { backgroundColor: '#007AFF' }]}>
                        <IconSymbol name="arrow.down.circle.fill" size={20} color="#fff" />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ========== NATIVE: Main panel ========== */}
            {!isWeb && panel === 'main' && (
              <>
                {/* Inline download progress */}
                {activeDownload && (
                  <View style={[styles.inlineProgress, { backgroundColor: rowBg, borderColor: separatorColor }]}>
                    <View style={styles.progressHeader}>
                      <ActivityIndicator size="small" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1}>
                          Downloading {activeDownload.presetLabel}…
                        </ThemedText>
                        <ThemedText style={styles.progressSubtext}>{activeDownload.targetLabel}</ThemedText>
                      </View>
                      <ThemedText style={styles.progressPct}>{activeDownload.progress.toFixed(0)}%</ThemedText>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(activeDownload.progress, 100)}%` }]} />
                    </View>
                  </View>
                )}

                {/* New download button */}
                <TouchableOpacity
                  onPress={() => setPanel('download')}
                  disabled={!!activeDownload}
                  activeOpacity={0.7}
                  style={[styles.newDownloadBtn, { backgroundColor: Colors[colorScheme].tint }, activeDownload && { opacity: 0.5 }]}
                >
                  <IconSymbol name="arrow.down.circle.fill" size={22} color="#fff" />
                  <ThemedText style={styles.newDownloadText}>Download New Area</ThemedText>
                </TouchableOpacity>

                {/* Info note */}
                <View style={[styles.infoNote, { backgroundColor: rowBg, borderColor: separatorColor }]}>
                  <IconSymbol name="info.circle.fill" size={16} color={Colors[colorScheme].tabIconDefault} />
                  <ThemedText style={styles.infoNoteText}>
                    Maps you browse online are automatically cached. Downloaded packs guarantee availability offline.
                  </ThemedText>
                </View>

                {/* Saved packs */}
                <ThemedText style={[styles.sectionLabel, { color: sectionHeaderColor, marginTop: 20 }]}>
                  SAVED MAP PACKS
                </ThemedText>

                {loadingPacks && (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" />
                  </View>
                )}

                {!loadingPacks && packs.length === 0 && (
                  <ThemedText style={styles.emptyText}>No offline maps downloaded yet.</ThemedText>
                )}

                {packs.map((pack) => (
                  <View key={pack.name} style={[styles.packRow, { backgroundColor: rowBg, borderColor: separatorColor }]}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold" numberOfLines={1}>
                        {pack.metadata?.preset ?? pack.name}
                      </ThemedText>
                      <ThemedText style={styles.packMeta}>
                        {formatBytes(pack.completedSize)} · {pack.completedCount} tiles
                        {pack.metadata?.target ? ` · ${pack.metadata.target}` : ''}
                      </ThemedText>
                      {pack.metadata?.created && (
                        <ThemedText style={styles.packMeta}>
                          {new Date(pack.metadata.created).toLocaleDateString()}
                        </ThemedText>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => deletePack(pack.name)} style={styles.deleteBtn}>
                      <IconSymbol name="trash.fill" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* ========== NATIVE: Download panel ========== */}
            {!isWeb && panel === 'download' && (
              <>
                {/* Location source */}
                <ThemedText style={[styles.sectionLabel, { color: sectionHeaderColor }]}>
                  DOWNLOAD CENTER
                </ThemedText>

                <View style={[styles.segmentedRow, { borderColor: separatorColor }]}>
                  <TouchableOpacity
                    onPress={() => setLocationMode('my-location')}
                    style={[
                      styles.segmentBtn,
                      locationMode === 'my-location' && { backgroundColor: Colors[colorScheme].tint },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.segmentText,
                        locationMode === 'my-location' && { color: '#fff' },
                      ]}
                    >
                      My Location
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setLocationMode('coordinates')}
                    style={[
                      styles.segmentBtn,
                      locationMode === 'coordinates' && { backgroundColor: Colors[colorScheme].tint },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.segmentText,
                        locationMode === 'coordinates' && { color: '#fff' },
                      ]}
                    >
                      Custom Location
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                {locationMode === 'my-location' && (
                  <View style={[styles.locationInfo, { backgroundColor: rowBg, borderColor: separatorColor }]}>
                    <IconSymbol name="location.fill.viewfinder" size={18} color={Colors[colorScheme].tint} />
                    <ThemedText style={styles.locationInfoText}>{locationSummary}</ThemedText>
                  </View>
                )}

                {locationMode === 'coordinates' && (
                  <View style={[styles.coordInputs, { backgroundColor: rowBg, borderColor: separatorColor }]}>
                    <View style={styles.coordRow}>
                      <ThemedText style={styles.coordLabel}>Lat</ThemedText>
                      <TextInput
                        style={[styles.coordInput, { borderColor: String(borderColor), color: String(textColor) }]}
                        placeholder="e.g. 51.5074"
                        placeholderTextColor={String(placeholderColor)}
                        value={customLat}
                        onChangeText={setCustomLat}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.coordRow}>
                      <ThemedText style={styles.coordLabel}>Lon</ThemedText>
                      <TextInput
                        style={[styles.coordInput, { borderColor: String(borderColor), color: String(textColor) }]}
                        placeholder="e.g. -0.1278"
                        placeholderTextColor={String(placeholderColor)}
                        value={customLon}
                        onChangeText={setCustomLon}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                )}

                {/* Radius selector */}
                <ThemedText style={[styles.sectionLabel, { color: sectionHeaderColor, marginTop: 16 }]}>
                  RADIUS
                </ThemedText>
                <View style={styles.radiusRow}>
                  {RADIUS_OPTIONS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRadiusKm(r)}
                      style={[
                        styles.radiusChip,
                        { borderColor: separatorColor },
                        radiusKm === r && { backgroundColor: Colors[colorScheme].tint, borderColor: Colors[colorScheme].tint },
                      ]}
                    >
                      <ThemedText
                        style={[styles.radiusChipText, radiusKm === r && { color: '#fff' }]}
                      >
                        {r} km
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Zoom presets */}
                <ThemedText style={[styles.sectionLabel, { color: sectionHeaderColor, marginTop: 16 }]}>
                  DETAIL LEVEL
                </ThemedText>
                <ThemedText style={styles.helpText}>
                  Higher detail = larger download. Overview is fast; Detailed includes every trail and contour.
                </ThemedText>

                {ZOOM_PRESETS.map((preset) => {
                  const isActive = !!activeDownload;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      disabled={isActive}
                      onPress={() => handleDownload(preset)}
                      activeOpacity={0.7}
                      style={[styles.presetRow, { backgroundColor: rowBg, borderColor: separatorColor }, isActive && { opacity: 0.5 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold">{preset.label}</ThemedText>
                        <ThemedText style={styles.presetDesc}>{preset.description}</ThemedText>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText style={styles.estimateText}>{preset.estimateLabel}</ThemedText>
                        <View style={[styles.downloadBtnCircle, { backgroundColor: Colors[colorScheme].tint }]}>
                          <IconSymbol name="arrow.down.circle.fill" size={20} color="#fff" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerButtonText: {
    fontSize: 13,
    opacity: 0.8,
  },
  scrollBody: {
    flexGrow: 0,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    opacity: 0.8,
  },
  helpText: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 12,
    marginLeft: 4,
  },
  newDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  newDownloadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    gap: 8,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    opacity: 0.6,
    lineHeight: 18,
  },
  inlineProgress: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressSubtext: {
    fontSize: 13,
    opacity: 0.5,
    marginTop: 1,
  },
  progressPct: {
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.7,
    marginLeft: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    gap: 10,
  },
  locationInfoText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.7,
  },
  coordInputs: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  coordLabel: {
    width: 36,
    fontSize: 14,
    fontWeight: '600',
  },
  coordInput: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    fontSize: 15,
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  radiusChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  presetDesc: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  estimateText: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 4,
  },
  downloadBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    marginVertical: 16,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  packMeta: {
    fontSize: 13,
    opacity: 0.5,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webDisabledContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  webIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(128,128,128,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  webTitle: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  webBody: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 340,
  },
  webPreviewSection: {
    width: '100%',
  },
});
