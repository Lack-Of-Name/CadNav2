import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AboutContent from '@/components/AboutContent';
import DownloadMapsModal from '@/components/DownloadMapsModal';
import { alert } from '@/components/alert';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import StyledButton from '@/components/ui/StyledButton';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useSettings, type ThemeMode } from '@/hooks/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as turf from '@turf/turf';
import { useRouter } from 'expo-router';

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textMuted }]}>{title.toUpperCase()}</ThemedText>
      {description ? <ThemedText style={[styles.sectionDescription, { color: theme.textMuted }]}>{description}</ThemedText> : null}
      <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        {children}
      </View>
    </View>
  );
}

const THEME_CHOICES: Array<{ value: ThemeMode; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: 'iphone' },
  { value: 'light', label: 'Light', icon: 'sun.max.fill' },
  { value: 'dark', label: 'Dark', icon: 'moon.stars.fill' },
];

function ThemeModeSelector({ value, onChange }: { value: ThemeMode; onChange: (next: ThemeMode) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.themeModeGrid}>
      {THEME_CHOICES.map((choice) => {
        const active = value === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            style={[
              styles.themeModeCard,
              {
                backgroundColor: active ? theme.primary : theme.background,
                borderColor: active ? theme.primary : theme.divider,
              },
            ]}
          >
            <View style={[styles.themeModeIcon, { backgroundColor: active ? 'rgba(255,255,255,0.16)' : theme.surface }]}>
              <IconSymbol name={choice.icon as any} size={18} color={active ? '#fff' : theme.primary} />
            </View>
            <ThemedText style={[styles.themeModeLabel, { color: active ? '#fff' : theme.text }]}>{choice.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingsHero() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      <View style={[styles.heroIcon, { backgroundColor: theme.primary }]}>
        <IconSymbol name="gearshape.fill" size={20} color="#fff" />
      </View>
      <View style={styles.heroText}>
        <ThemedText type="title" style={styles.heroTitle}>Settings</ThemedText>
        <ThemedText style={[styles.heroSubtitle, { color: theme.textMuted }]}>
          Appearance, navigation, grid, and map controls in one clean place.
        </ThemedText>
      </View>
    </View>
  );
}

function SettingsRow({ 
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
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { activeRouteColor } = useCheckpoints();

  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color ?? activeRouteColor ?? theme.tint }]}>
        <IconSymbol name={icon as any} size={18} color="#fff" />
      </View>
      <View style={styles.rowContent}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <View style={styles.rowRight}>
          {value && <ThemedText style={styles.rowValue}>{value}</ThemedText>}
          {rightElement}
          {onPress && !rightElement && (
            <IconSymbol name="chevron.right" size={20} color={theme.textMuted} style={{ marginLeft: 8 }} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const textColor = theme.text;
  const { angleUnit, mapHeading, mapLayer, gridConvergence, mapGridOrigin, mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, themeMode, setSetting } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();
  const { lastLocation, requestLocation } = useGPS();
  const { selectedCheckpoint } = useCheckpoints();
  const [infoOpen, setInfoOpen] = useState(false);
  const [downloadMapsOpen, setDownloadMapsOpen] = useState(false);
  const [gridModalOpen, setGridModalOpen] = useState(false);
  const [gridPanel, setGridPanel] = useState<'menu' | 'overlays' | 'origin' | 'convergence'>('menu');
  const [originEasting, setOriginEasting] = useState('');
  const [originNorthing, setOriginNorthing] = useState('');
  const [originEastingSign, setOriginEastingSign] = useState<1 | -1>(1);
  const [originNorthingSign, setOriginNorthingSign] = useState<1 | -1>(1);
  const [originError, setOriginError] = useState<string | null>(null);
  
  const borderColor = theme.divider;
  const background = theme.background;
  const placeholderColor = theme.textSubtle;
  const rowBg = theme.surface;

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

  async function handleClearCache() {
    await alert({
      title: 'Clear Tile Cache',
      message: 'Are you sure you want to clear dynamically loaded map tiles? Downloaded offline maps will not be affected.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive', 
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                const ml = require('@maplibre/maplibre-react-native');
                const mgr = ml.offlineManager ?? ml.default?.offlineManager;
                if (mgr) {
                  await mgr.clearAmbientCache();
                  await alert({ title: 'Cache Cleared', message: 'The map tile cache has been cleared.', buttons: [{ text: 'OK' }] });
                }
              } else {
                 await alert({ title: 'Not Supported', message: 'Clearing cache is not supported on web.', buttons: [{ text: 'OK' }] });
              }
            } catch (e) {
              await alert({ title: 'Error', message: String(e), buttons: [{ text: 'OK' }] });
            }
          }
        },
      ],
    });
  }

  async function saveConvergence() {
    const v = inputConvergence.trim();
    const n = parseFloat(v);
    if (!v) {
      await setSetting('gridConvergence', null);
      setGridModalOpen(false);
    } else if (!Number.isFinite(n)) {
      await alert({ title: 'Invalid', message: 'Please enter a valid number for convergence.' });
    } else {
      await setSetting('gridConvergence', n);
      setGridModalOpen(false);
    }
  }

  function parseGridValue(value: string, sign: 1 | -1) {
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
    return { meters: num * scale * sign, digits: len };
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
    setGridModalOpen(false);
  }

  async function setOriginFromGridRef() {
    setOriginError(null);
    if (!lastLocation) {
      requestLocation();
      setOriginError('Current location unavailable. Try again once GPS is ready.');
      return;
    }

    const eParsed = parseGridValue(originEasting, originEastingSign);
    const nParsed = parseGridValue(originNorthing, originNorthingSign);

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
    setGridModalOpen(false);
  }

  async function setOriginFromCheckpoint(latitude: number, longitude: number) {
    await setSetting('mapGridOrigin', { latitude, longitude });
    setGridModalOpen(false);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}> 
      {Platform.OS === 'web' && (
        <View style={[styles.topBar, { backgroundColor: theme.surface, borderBottomColor: borderColor }]}> 
          <TouchableOpacity 
            style={[styles.backBtn, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: theme.text }]}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
      )}
      <ScrollView bounces={false} overScrollMode="never" style={styles.scroll} contentContainerStyle={styles.container}>
        {Platform.OS !== 'web' && <SettingsHero />}

        <SettingsSection title="Appearance" description="Choose how the app looks on this device.">
          <View style={styles.appearanceBlock}>
            <ThemedText style={[styles.appearanceLabel, { color: theme.textMuted }]}>Theme</ThemedText>
            <ThemeModeSelector
              value={themeMode}
              onChange={(next) => void setSetting('themeMode', next)}
            />
          </View>
        </SettingsSection>

        <SettingsSection title="Navigation" description="How bearings and north are interpreted.">
          <SettingsRow 
            icon="ruler.fill" 
            label="Angle Units" 
            color={theme.warning}
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={styles.rowValue}>{isMils ? 'Mils' : 'Degrees'}</ThemedText>
                <ThemeSwitch
                  value={isMils}
                  onValueChange={(v) => setSetting('angleUnit', v ? 'mils' : 'degrees')}
                />
              </View>
            }
          />
          <SettingsRow 
            icon="compass.drawing" 
            label="North Reference" 
            color={theme.primary}
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={styles.rowValue}>{isTrue ? 'True' : 'Magnetic'}</ThemedText>
                <ThemeSwitch
                  value={isTrue}
                  onValueChange={(v) => setSetting('mapHeading', v ? 'true' : 'magnetic')}
                />
              </View>
            }
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Grid" description="Fine-tune the grid overlay and origin settings.">
          <SettingsRow 
            icon="square.grid.3x3" 
            label="Grid Overlay" 
            color={theme.secondary}
            rightElement={
              <ThemeSwitch 
                value={mapGridEnabled} 
                onValueChange={(v) => void setSetting('mapGridEnabled', v)} 
              />
            }
            isLast={!mapGridEnabled}
          />
          {mapGridEnabled && (
            <>
              <SettingsRow 
                icon="square.split.2x2" 
                label="Subdivisions" 
                color={theme.secondary}
                rightElement={
                  <ThemeSwitch
                    value={mapGridSubdivisionsEnabled}
                    onValueChange={(v) => void setSetting('mapGridSubdivisionsEnabled', v)}
                  />
                }
              />
              <SettingsRow 
                icon="textformat.123" 
                label="Grid Labels" 
                color={theme.secondary}
                rightElement={
                  <ThemeSwitch
                    value={mapGridNumbersEnabled}
                    onValueChange={(v) => void setSetting('mapGridNumbersEnabled', v)}
                  />
                }
              />
            </>
          )}
          <SettingsRow
            icon="mappin.and.ellipse"
            label="Grid Origin"
            color={theme.primary}
            value={mapGridOrigin ? 'Configured' : 'Not set'}
            onPress={() => {
              setOriginError(null);
              setGridPanel('origin');
              setGridModalOpen(true);
            }}
          />
          <SettingsRow
            icon="compass.drawing"
            label="Grid Convergence"
            color={theme.primary}
            value={gridConvergence != null ? `${gridConvergence}°` : 'Not set'}
            onPress={() => {
              setOriginError(null);
              setGridPanel('convergence');
              setGridModalOpen(true);
            }}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Map" description="Map layer, offline packs, and map key management.">
          <SettingsRow 
            icon="square.stack.3d.up.fill" 
            label="Map Layer" 
            color={theme.warning}
            value={mapLayer === 'outdoor' ? 'Outdoor' : mapLayer === 'satellite' ? 'Satellite' : 'Auto Dark'}
            onPress={() => {
              const next = mapLayer === 'outdoor' ? 'satellite' : mapLayer === 'satellite' ? 'auto' : 'outdoor';
              void setSetting('mapLayer', next);
            }}
          />
          <SettingsRow 
            icon="arrow.down.circle.fill" 
            label="Offline Maps"
            color={theme.secondary}
            value="Offline"
            onPress={() => setDownloadMapsOpen(true)}
          />
          <SettingsRow 
            icon="key.fill"
            label="MapTiler API Key" 
            color={theme.primary}
            value={apiKey ? 'Configured' : 'Missing'}
            onPress={handleResetApiKey}
          />
          <SettingsRow 
            icon="trash.fill"
            label="Clear Tile Cache"
            color={theme.error}
            onPress={handleClearCache}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="App" description="About this app and maintenance actions.">
          <SettingsRow
            icon="info.circle.fill"
            label="About CadNav"
            color={theme.textMuted}
            onPress={() => setInfoOpen(true)}
            isLast
          />
        </SettingsSection>

        <ThemedText style={styles.footerText}>CadNav v1.0.0</ThemedText>
      </ScrollView>

      {/* Grid Settings Modal */}
      <Modal visible={gridModalOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setGridModalOpen(false); }} />
            <TouchableWithoutFeedback onPress={() => Platform.OS !== 'web' && Keyboard.dismiss()} accessible={false}>
              <ThemedView style={[styles.modalContainer, { backgroundColor: String(background), borderColor: String(borderColor) }]}> 
                <ScrollView
                  bounces={false}
                  overScrollMode="never"
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScroll}
                >
                  <View style={styles.modalHeaderRow}>
                    <View style={{ width: 64 }} />
                    <ThemedText type="subtitle">
                      {gridPanel === 'origin' ? 'Grid Origin' : 'Grid Convergence'}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => setGridModalOpen(false)}
                      style={[styles.headerButton, { borderColor: String(borderColor), backgroundColor: String(rowBg) }]}
                    >
                      <ThemedText style={styles.headerButtonText}>Close</ThemedText>
                    </TouchableOpacity>
                  </View>

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
                        <StyledButton variant="secondary" onPress={() => setGridModalOpen(false)}>Cancel</StyledButton>
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
                        <View style={[styles.inputContainer, { borderColor: String(borderColor) }]}>
                          <TouchableOpacity 
                            style={[styles.signButton, { borderRightColor: String(borderColor) }]} 
                            onPress={() => setOriginEastingSign(s => s === 1 ? -1 : 1)}
                          >
                            <ThemedText style={styles.signText}>{originEastingSign === 1 ? '+' : '-'}</ThemedText>
                          </TouchableOpacity>
                          <TextInput
                            style={[styles.inputWithSign, { color: String(textColor) }]}
                            placeholder="e.g. 12"
                            placeholderTextColor={String(placeholderColor)}
                            value={originEasting}
                            onChangeText={(t) => { setOriginEasting(t.replace(/[^0-9]/g, '')); setOriginError(null); }}
                            keyboardType="numeric"
                            maxLength={5}
                          />
                        </View>

                        <ThemedText style={{ marginTop: 8 }}>Northing</ThemedText>
                        <View style={[styles.inputContainer, { borderColor: String(borderColor) }]}>
                          <TouchableOpacity 
                            style={[styles.signButton, { borderRightColor: String(borderColor) }]} 
                            onPress={() => setOriginNorthingSign(s => s === 1 ? -1 : 1)}
                          >
                            <ThemedText style={styles.signText}>{originNorthingSign === 1 ? '+' : '-'}</ThemedText>
                          </TouchableOpacity>
                          <TextInput
                            style={[styles.inputWithSign, { color: String(textColor) }]}
                            placeholder="e.g. 34"
                            placeholderTextColor={String(placeholderColor)}
                            value={originNorthing}
                            onChangeText={(t) => { setOriginNorthing(t.replace(/[^0-9]/g, '')); setOriginError(null); }}
                            keyboardType="numeric"
                            maxLength={5}
                          />
                        </View>

                        <View style={{ marginTop: 10 }}>
                          <StyledButton variant="secondary" onPress={setOriginFromGridRef}>
                            Use this grid reference
                          </StyledButton>
                        </View>
                      </View>

                      {originError ? <ThemedText style={styles.error}>{originError}</ThemedText> : null}
                    </View>
                  ) : null}
                </ScrollView>
              </ThemedView>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Download Maps Modal */}
      <DownloadMapsModal visible={downloadMapsOpen} onClose={() => setDownloadMapsOpen(false)} />

      {/* About Modal */}
      <Modal visible={infoOpen} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: String(background), borderColor: String(borderColor), height: '80%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title">About</ThemedText>
              <StyledButton variant="secondary" onPress={() => setInfoOpen(false)}>Close</StyledButton>
            </View>
            <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.modalScroll}>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  pageTitle: {
    marginBottom: 20,
    marginLeft: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
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
  sectionDescription: {
    fontSize: 13,
    marginLeft: 16,
    marginBottom: 10,
    marginTop: -2,
    opacity: 0.75,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  appearanceBlock: {
    padding: 16,
    gap: 10,
  },
  appearanceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeModeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  themeModeCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  themeModeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeModeLabel: {
    fontSize: 13,
    fontWeight: '600',
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
  inputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  signButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  signText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputWithSign: {
    flex: 1,
    padding: 12,
    fontSize: 16,
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
