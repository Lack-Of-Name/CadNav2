import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AboutContent from '@/components/AboutContent';
import { alert } from '@/components/alert';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as turf from '@turf/turf';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const safeBg = useThemeColor({}, 'background');
  const { angleUnit, mapHeading, gridConvergence, mapGridOrigin, mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, setSetting } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();
  const { lastLocation, requestLocation } = useGPS();
  const { selectedCheckpoint } = useCheckpoints();
  const [infoOpen, setInfoOpen] = useState(false);
  const [gridModalOpen, setGridModalOpen] = useState(false);
  const [gridPanel, setGridPanel] = useState<'menu' | 'overlays' | 'origin' | 'convergence'>('menu');
  const [originEasting, setOriginEasting] = useState('');
  const [originNorthing, setOriginNorthing] = useState('');
  const [originError, setOriginError] = useState<string | null>(null);
  
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'text');
  const sectionHeaderColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const rowBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const separatorColor = useThemeColor({ light: '#e5e5ea', dark: '#38383a' }, 'icon');

  const [inputConvergence, setInputConvergence] = useState<string>('');
  useEffect(() => {
    setInputConvergence(gridConvergence != null ? String(gridConvergence) : '');
  }, [gridConvergence]);

  const gridOriginLabel = useMemo(() => {
    if (!mapGridOrigin) return 'Not set';
    return `${mapGridOrigin.latitude.toFixed(6)}, ${mapGridOrigin.longitude.toFixed(6)}`;
  }, [mapGridOrigin]);

  const isMils = angleUnit === 'mils';
  const isTrue = mapHeading === 'true';
  const switchTrackOn = Colors[colorScheme].tint;
  const switchThumb = '#fff'; // Standard iOS look

  async function handleResetApiKey() {
    await alert({
      title: 'Reset MapTiler API Key',
      message: 'Delete the stored MapTiler API key and enter a new one?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: async () => await clearApiKey() },
      ],
    });
  }

  async function saveConvergence() {
    const v = inputConvergence.trim();
    const n = parseFloat(v);
    if (!v) {
      await setSetting('gridConvergence', null);
      setGridPanel('menu');
    } else if (!Number.isFinite(n)) {
      await alert({ title: 'Invalid', message: 'Please enter a valid number for convergence.' });
    } else {
      await setSetting('gridConvergence', n);
      setGridPanel('menu');
    }
  }

  function parseGridValue(value: string) {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) return null;
    const len = trimmed.length;
    if (len < 1 || len > 5) return null;
    const scaleByDigits: Record<number, number> = {
      1: 10000,
      2: 1000,
      3: 100,
      4: 10,
      5: 1,
    };
    const scale = scaleByDigits[len];
    const num = parseInt(trimmed, 10);
    return { meters: num * scale, digits: len };
  }

  async function setOriginToMyLocation() {
    setOriginError(null);
    if (!lastLocation) {
      requestLocation();
      setOriginError('Current location unavailable. Try again once GPS is ready.');
      return;
    }
    const { latitude, longitude } = lastLocation.coords;
    await setSetting('mapGridOrigin', { latitude, longitude });
    setGridPanel('menu');
  }

  async function setOriginFromGridRef() {
    setOriginError(null);
    if (!lastLocation) {
      requestLocation();
      setOriginError('Current location unavailable. Try again once GPS is ready.');
      return;
    }

    const eParsed = parseGridValue(originEasting);
    const nParsed = parseGridValue(originNorthing);

    if (!eParsed || !nParsed) {
      setOriginError('Enter grid digits only (1–5 digits each).');
      return;
    }

    if (eParsed.digits !== nParsed.digits) {
      setOriginError('Easting and Northing must have the same number of digits (1–5).');
      return;
    }

    const lat = lastLocation.coords.latitude;
    const lon = lastLocation.coords.longitude;

    const ex = -eParsed.meters;
    const ny = -nParsed.meters;
    const theta = (gridConvergence ?? 0) * (Math.PI / 180);
    const eTrue = ex * Math.cos(theta) - ny * Math.sin(theta);
    const nTrue = ex * Math.sin(theta) + ny * Math.cos(theta);
    const dist = Math.hypot(eTrue, nTrue);
    const bearing = (Math.atan2(eTrue, nTrue) * 180) / Math.PI;
    const bearingNormalized = (bearing + 360) % 360;

    const finalPoint = turf.destination([lon, lat], dist, bearingNormalized, { units: 'meters' });
    const [originLon, originLat] = finalPoint.geometry.coordinates;

    await setSetting('mapGridOrigin', { latitude: originLat, longitude: originLon });
    setGridPanel('menu');
  }

  async function setOriginFromCheckpoint(latitude: number, longitude: number) {
    await setSetting('mapGridOrigin', { latitude, longitude });
    setGridPanel('menu');
  }

  const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: sectionHeaderColor }]}>{title.toUpperCase()}</ThemedText>
      <View style={[styles.sectionContent, { backgroundColor: rowBg, borderColor: separatorColor }]}>
        {children}
      </View>
    </View>
  );

  const SettingsRow = ({ 
    icon, 
    label, 
    value, 
    onPress, 
    rightElement,
    isLast = false,
    color
  }: { 
    icon: string; 
    label: string; 
    value?: string; 
    onPress?: () => void; 
    rightElement?: React.ReactNode;
    isLast?: boolean;
    color?: string;
  }) => (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color ?? Colors[colorScheme].tint }]}>
        <IconSymbol name={icon as any} size={18} color="#fff" />
      </View>
      <View style={styles.rowContent}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <View style={styles.rowRight}>
          {value && <ThemedText style={styles.rowValue}>{value}</ThemedText>}
          {rightElement}
          {onPress && !rightElement && (
            <IconSymbol name="chevron.right" size={20} color={Colors[colorScheme].tabIconDefault} style={{ marginLeft: 8 }} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: safeBg }]}> 
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.pageTitle}>Settings</ThemedText>

        <SettingsSection title="Navigation">
          <SettingsRow 
            icon="ruler.fill" 
            label="Angle Units" 
            color="#FF9500"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={styles.rowValue}>{isMils ? 'Mils' : 'Degrees'}</ThemedText>
                <Switch
                  value={isMils}
                  onValueChange={(v) => setSetting('angleUnit', v ? 'mils' : 'degrees')}
                  trackColor={{ false: '#e9e9ea', true: switchTrackOn }}
                  thumbColor={switchThumb}
                />
              </View>
            }
          />
          <SettingsRow 
            icon="compass.drawing" 
            label="North Reference" 
            color="#007AFF"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={styles.rowValue}>{isTrue ? 'True' : 'Magnetic'}</ThemedText>
                <Switch
                  value={isTrue}
                  onValueChange={(v) => setSetting('mapHeading', v ? 'true' : 'magnetic')}
                  trackColor={{ false: '#e9e9ea', true: switchTrackOn }}
                  thumbColor={switchThumb}
                />
              </View>
            }
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Grid">
          <SettingsRow
            icon="square.grid.3x3"
            label="Grid Settings"
            color="#AF52DE"
            value={mapGridEnabled ? 'Enabled' : 'Disabled'}
            onPress={() => {
              setOriginError(null);
              setGridPanel('menu');
              setGridModalOpen(true);
            }}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Map">
          <SettingsRow 
            icon="map.fill" 
            label="MapTiler API Key" 
            color="#34C759"
            value={apiKey ? 'Configured' : 'Missing'}
            onPress={handleResetApiKey}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="App">
          <SettingsRow 
            icon="info.circle.fill" 
            label="About CadNav" 
            color="#8E8E93"
            onPress={() => setInfoOpen(true)}
            isLast
          />
        </SettingsSection>

        <ThemedText style={styles.footerText}>CadNav v1.0.0</ThemedText>
      </ScrollView>

      {/* Grid Settings Modal */}
      <Modal visible={gridModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: String(background), borderColor: String(borderColor) }]}> 
            <View style={styles.modalHeaderRow}>
              {gridPanel !== 'menu' ? (
                <TouchableOpacity
                  onPress={() => setGridPanel('menu')}
                  style={[styles.headerButton, { borderColor: String(borderColor), backgroundColor: String(rowBg) }]}
                >
                  <ThemedText style={styles.headerButtonText}>Back</ThemedText>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 64 }} />
              )}
              <ThemedText type="subtitle">Grid Settings</ThemedText>
              <TouchableOpacity
                onPress={() => setGridModalOpen(false)}
                style={[styles.headerButton, { borderColor: String(borderColor), backgroundColor: String(rowBg) }]}
              >
                <ThemedText style={styles.headerButtonText}>Close</ThemedText>
              </TouchableOpacity>
            </View>

            {gridPanel === 'menu' ? (
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity style={[styles.menuRow, { backgroundColor: rowBg, borderColor: separatorColor }]} onPress={() => setGridPanel('overlays')}>
                  <View style={[styles.menuIcon, { backgroundColor: '#33eaad' }]}>
                    <IconSymbol name="square.grid.3x3" size={18} color="#fff" />
                  </View>
                  <ThemedText style={styles.menuLabel}>Overlays</ThemedText>
                  <IconSymbol name="chevron.right" size={18} color={Colors[colorScheme].tabIconDefault} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuRow, { backgroundColor: rowBg, borderColor: separatorColor }]} onPress={() => setGridPanel('origin')}>
                  <View style={[styles.menuIcon, { backgroundColor: '#5AC8FA' }]}>
                    <IconSymbol name="mappin.and.ellipse" size={18} color="#fff" />
                  </View>
                  <ThemedText style={styles.menuLabel}>Origin</ThemedText>
                  <IconSymbol name="chevron.right" size={18} color={Colors[colorScheme].tabIconDefault} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuRow, { backgroundColor: rowBg, borderColor: separatorColor }]} onPress={() => setGridPanel('convergence')}>
                  <View style={[styles.menuIcon, { backgroundColor: '#AF52DE' }]}>
                    <IconSymbol name="compass.drawing" size={18} color="#fff" />
                  </View>
                  <ThemedText style={styles.menuLabel}>Convergence</ThemedText>
                  <IconSymbol name="chevron.right" size={18} color={Colors[colorScheme].tabIconDefault} />
                </TouchableOpacity>
              </View>
            ) : null}

            {gridPanel === 'overlays' ? (
              <View style={{ marginTop: 12 }}>
                <View style={styles.gridRowInline}>
                  <ThemedText type="defaultSemiBold">Enabled</ThemedText>
                  <Switch value={mapGridEnabled} onValueChange={(v) => void setSetting('mapGridEnabled', v)} />
                </View>

                <View style={styles.gridRowInline}>
                  <ThemedText type="defaultSemiBold">Subdivisions</ThemedText>
                  <Switch
                    value={mapGridSubdivisionsEnabled}
                    onValueChange={(v) => void setSetting('mapGridSubdivisionsEnabled', v)}
                    disabled={!mapGridEnabled}
                  />
                </View>

                <View style={styles.gridRowInline}>
                  <ThemedText type="defaultSemiBold">Grid numbers</ThemedText>
                  <Switch
                    value={mapGridNumbersEnabled}
                    onValueChange={(v) => void setSetting('mapGridNumbersEnabled', v)}
                    disabled={!mapGridEnabled}
                  />
                </View>
              </View>
            ) : null}

            {gridPanel === 'convergence' ? (
              <View style={{ marginTop: 12 }}>
                <ThemedText style={{ marginBottom: 12 }}>
                  Enter the angle between true north and grid north (positive if grid north is east of true north).
                </ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: String(borderColor), color: String(textColor) }]}
                  placeholder="e.g. -1.23"
                  placeholderTextColor={String(placeholderColor)}
                  value={inputConvergence}
                  onChangeText={setInputConvergence}
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <StyledButton variant="secondary" onPress={() => setGridPanel('menu')}>Cancel</StyledButton>
                  <View style={{ width: 12 }} />
                  <StyledButton variant="primary" onPress={saveConvergence}>Save</StyledButton>
                </View>
              </View>
            ) : null}

            {gridPanel === 'origin' ? (
              <View style={{ marginTop: 12 }}>
                <ThemedText style={{ marginBottom: 6 }}>Current origin</ThemedText>
                <ThemedText style={{ marginBottom: 16, opacity: 0.7 }}>{gridOriginLabel}</ThemedText>

                <StyledButton variant="primary" onPress={setOriginToMyLocation}>
                  Use my location
                </StyledButton>

                <View style={{ marginTop: 10 }}>
                  <StyledButton
                    variant="secondary"
                    onPress={() => selectedCheckpoint && setOriginFromCheckpoint(selectedCheckpoint.latitude, selectedCheckpoint.longitude)}
                    disabled={!selectedCheckpoint}
                  >
                    Use selected checkpoint
                  </StyledButton>
                  {!selectedCheckpoint ? (
                    <ThemedText style={{ marginTop: 6, opacity: 0.7 }}>No checkpoint selected.</ThemedText>
                  ) : null}
                </View>

                <View style={{ marginTop: 16 }}>
                  <ThemedText type="defaultSemiBold">I am at this grid reference</ThemedText>
                  <ThemedText style={{ marginTop: 4, opacity: 0.7 }}>
                    Digits set precision (1–5).
                  </ThemedText>

                  <ThemedText style={{ marginTop: 8 }}>Easting</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: String(borderColor), color: String(textColor) }]}
                    placeholder="e.g. 12"
                    placeholderTextColor={String(placeholderColor)}
                    value={originEasting}
                    onChangeText={(t) => { setOriginEasting(t.replace(/[^0-9]/g, '')); setOriginError(null); }}
                    keyboardType="numeric"
                    maxLength={5}
                  />

                  <ThemedText style={{ marginTop: 8 }}>Northing</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: String(borderColor), color: String(textColor) }]}
                    placeholder="e.g. 34"
                    placeholderTextColor={String(placeholderColor)}
                    value={originNorthing}
                    onChangeText={(t) => { setOriginNorthing(t.replace(/[^0-9]/g, '')); setOriginError(null); }}
                    keyboardType="numeric"
                    maxLength={5}
                  />

                  <View style={{ marginTop: 10 }}>
                    <StyledButton variant="secondary" onPress={setOriginFromGridRef}>
                      Use this grid reference
                    </StyledButton>
                  </View>
                </View>

                {originError ? <ThemedText style={styles.error}>{originError}</ThemedText> : null}
              </View>
            ) : null}
          </ThemedView>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal visible={infoOpen} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: String(background), borderColor: String(borderColor), height: '80%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title">About</ThemedText>
              <StyledButton variant="secondary" onPress={() => setInfoOpen(false)}>Close</StyledButton>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <AboutContent />
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    marginBottom: 20,
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 16,
    opacity: 0.8,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 17,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 17,
    opacity: 0.6,
    marginRight: 4,
  },
  footerText: {
    textAlign: 'center',
    opacity: 0.4,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  menuIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
  },
  gridRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  backText: {
    opacity: 0.7,
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
  error: {
    color: 'red',
    marginTop: 10,
  },
});