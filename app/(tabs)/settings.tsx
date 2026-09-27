import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AboutContent from '@/components/AboutContent';
import DownloadMapsModal from '@/components/DownloadMapsModal';
import { alert } from '@/components/alert';
import { useMapTilerKey } from '@/components/map/MapTilerKeyProvider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ColorSlider } from '@/components/ui/ColorSlider';
import StyledButton from '@/components/ui/StyledButton';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius } from '@/constants/theme';
import { tutorials } from '@/constants/tutorials';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useSettings, type GpsMode, type MapLayer, type ThemeMode } from '@/hooks/settings';
import { useTutorials } from '@/hooks/tutorials';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { hexToHsv, hsvToHex } from '@/lib/colorUtils';
import { getMaplibreModule } from '@/lib/maplibreModule';
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

const THEME_CHOICES: { value: ThemeMode; label: string; icon: string }[] = [
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
                backgroundColor: active ? theme.primary + '14' : theme.background,
                borderColor: active ? theme.primary : theme.divider,
              },
            ]}
          >
            <View style={[styles.themeModeIcon, { backgroundColor: active ? theme.primary : theme.background }]}>
              <IconSymbol name={choice.icon as any} size={18} color={active ? '#fff' : theme.primary} />
            </View>
            <ThemedText style={[styles.themeModeLabel, { color: active ? theme.primary : theme.text }]}>{choice.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const GPS_MODE_CHOICES: { value: GpsMode; label: string; icon: string; desc: string }[] = [
  { value: 'highAccuracy', label: 'Best Accuracy', icon: 'location.fill', desc: 'GPS + network' },
  { value: 'gpsOnly', label: 'GPS Priority', icon: 'antenna.radiowaves.left.and.right', desc: 'Satellite preferred' },
  { value: 'powerSave', label: 'Power Saving', icon: 'bolt.fill', desc: 'Network, less battery' },
  { value: 'super', label: 'Super Saving', icon: 'leaf.fill', desc: 'Disables the map' },
];

function GpsModeSelector({ value, onChange }: { value: GpsMode; onChange: (next: GpsMode) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.gpsModeGrid}>
      {GPS_MODE_CHOICES.map((choice) => {
        const active = value === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.gpsModeCard,
              {
                backgroundColor: active ? theme.primary + '14' : theme.background,
                borderColor: active ? theme.primary : theme.divider,
              },
            ]}
          >
            <View style={[styles.themeModeIcon, { backgroundColor: active ? theme.primary : theme.background }]}>
              <IconSymbol name={choice.icon as any} size={20} color={active ? '#fff' : theme.primary} />
            </View>
            <ThemedText style={[styles.themeModeLabel, { color: active ? theme.primary : theme.text }]}>{choice.label}</ThemedText>
            <ThemedText style={[styles.themeModeLabel, { color: theme.textMuted, fontSize: 11 }]}>{choice.desc}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function TutorialList({ onOpen }: { onOpen: (id: string) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { hasCompleted } = useTutorials();

  return (
    <View>
      {tutorials.map((t, index) => {
        const done = hasCompleted(t.id);
        const stepCount = t.pages.length > 0 ? `${t.pages.length} steps` : 'Reference';
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => onOpen(t.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${t.title}${done ? ', completed' : ''}`}
            style={[
              styles.tutorialRow,
              index < tutorials.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
            ]}
          >
            <View style={[styles.tutorialDot, { backgroundColor: done ? theme.success : theme.warning }]} />
            <View style={styles.tutorialRowCopy}>
              <ThemedText style={styles.tutorialRowTitle}>{t.title}</ThemedText>
              <ThemedText style={[styles.tutorialRowSub, { color: theme.textMuted }]}>
                {done ? `Completed · ${stepCount}` : stepCount}
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Placeholder layer previews — to update the artwork, overwrite these two
// PNG files in place (same filenames, ideally ~384x240).
const MAP_LAYER_CHOICES: { value: MapLayer; label: string; desc: string; image: number }[] = [
  { value: 'outdoor', label: 'Outdoor', desc: 'Topo trails', image: require('@/assets/images/map-outdoor.png') },
  { value: 'satellite', label: 'Satellite', desc: 'Aerial imagery', image: require('@/assets/images/map-satellite.png') },
];

function MapLayerSelector({ value, onChange }: { value: MapLayer; onChange: (next: MapLayer) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.mapLayerGrid}>
      {MAP_LAYER_CHOICES.map((choice) => {
        const active = value === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${choice.label} map layer${active ? ', selected' : ''}`}
            style={[
              styles.mapLayerCard,
              {
                backgroundColor: theme.background,
                borderColor: active ? theme.primary : theme.divider,
              },
            ]}
          >
            <Image source={choice.image} style={styles.mapLayerImage} resizeMode="cover" />
            <View style={styles.mapLayerBody}>
              <View style={styles.mapLayerLabelRow}>
                <ThemedText style={[styles.mapLayerLabel, { color: theme.text }]}>{choice.label}</ThemedText>
                <View style={[styles.mapLayerDot, { backgroundColor: active ? theme.primary : 'transparent', borderColor: active ? theme.primary : theme.divider }]} />
              </View>
              <ThemedText style={[styles.mapLayerDesc, { color: theme.textMuted }]}>{choice.desc}</ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function LocationDotSelector({ value, onChange }: { value: string | null; onChange: (next: string | null) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [draft, setDraft] = useState(value ?? theme.primary);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (commitTimer.current) clearTimeout(commitTimer.current); }, []);

  // While following the theme default, keep the preview tracking theme changes.
  useEffect(() => {
    if (value == null) setDraft(theme.primary);
  }, [value, theme.primary]);

  const hsv = useMemo(() => hexToHsv(draft), [draft]);
  const satStops = useMemo(
    () => [hsvToHex(hsv.h, 0, hsv.v), hsvToHex(hsv.h, 100, hsv.v)],
    [hsv.h, hsv.v],
  );
  const valStops = useMemo(
    () => [hsvToHex(hsv.h, hsv.s, 0), hsvToHex(hsv.h, hsv.s, 100)],
    [hsv.h, hsv.s],
  );

  // Sliders fire per-frame while dragging — persist debounced, preview instantly.
  const commit = (hex: string) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => { void onChange(hex); }, 450);
  };
  const applyChannel = (hex: string) => { setDraft(hex); commit(hex); };
  const setHue = (h: number) => applyChannel(hsvToHex(h, hsv.s, hsv.v));
  const setSaturation = (s: number) => applyChannel(hsvToHex(hsv.h, s, hsv.v));
  const setValue = (v: number) => applyChannel(hsvToHex(hsv.h, hsv.s, v));

  const resetToDefault = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    setDraft(theme.primary);
    void onChange(null);
  };

  return (
    <View>
      <View style={styles.hsvRow}>
        <View style={[styles.colorPreview, { backgroundColor: draft, borderColor: theme.divider }]} />
        <View style={styles.hsvSliders}>
          <View style={styles.sliderLine}>
            <ThemedText style={[styles.hsvTag, { color: theme.textMuted }]}>H</ThemedText>
            <ColorSlider value={hsv.h} min={0} max={360} stops={HUE_STOPS} onChange={setHue} />
          </View>
          <View style={styles.sliderLine}>
            <ThemedText style={[styles.hsvTag, { color: theme.textMuted }]}>S</ThemedText>
            <ColorSlider value={hsv.s} min={0} max={100} stops={satStops} onChange={setSaturation} />
          </View>
          <View style={styles.sliderLine}>
            <ThemedText style={[styles.hsvTag, { color: theme.textMuted }]}>V</ThemedText>
            <ColorSlider value={hsv.v} min={0} max={100} stops={valStops} onChange={setValue} />
          </View>
        </View>
      </View>
      <View style={styles.dotFooter}>
        <ThemedText style={[styles.dotCaption, { color: theme.textMuted }]}>
          {value == null ? 'Theme default' : value.toUpperCase()}
        </ThemedText>
        {value != null ? (
          <Pressable
            onPress={resetToDefault}
            accessibilityRole="button"
            accessibilityLabel="Reset location dot to theme default"
            hitSlop={8}
          >
            <ThemedText style={[styles.dotReset, { color: theme.primary }]}>RESET</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

const DIM_STOPS = ['#000000', '#FFFFFF'];

function BrightnessSelector({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [draft, setDraft] = useState(value);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (commitTimer.current) clearTimeout(commitTimer.current); }, []);

  // Sliders fire per-frame while dragging — persist debounced, preview instantly.
  const handleChange = (v: number) => {
    const next = Math.min(100, Math.max(0, Math.round(v)));
    setDraft(next);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => { void onChange(next); }, 450);
  };

  return (
    <View>
      <View style={styles.brightRow}>
        <ColorSlider value={draft} min={0} max={100} stops={DIM_STOPS} onChange={handleChange} />
        <ThemedText style={[styles.brightValue, { color: theme.text }]}>
          {`${draft}%`}
        </ThemedText>
      </View>
      <ThemedText style={[styles.dotCaption, { color: theme.textMuted }]}>
        Dims the map tiles for night use — slide left to darken.
        Buttons, widgets and the compass stay full brightness, and map touches
        pass straight through. At 100% there is no overlay at all.
      </ThemedText>
    </View>
  );
}

function SettingsHero() {  const colorScheme = useColorScheme() ?? 'light';
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
  const { angleUnit, mapHeading, mapLayer, mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, themeMode, gpsMode, locationDotColor, mapBrightness, setSetting } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();
  const { showTutorial } = useTutorials();
  const [infoOpen, setInfoOpen] = useState(false);
  const [downloadMapsOpen, setDownloadMapsOpen] = useState(false);

  const borderColor = theme.divider;
  const background = theme.background;

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
                const ml = getMaplibreModule() as any;
                const mgr = ml?.offlineManager ?? ml?.default?.offlineManager;
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

        <SettingsSection title="Grid" description="Toggle the MGRS grid overlay on the map.">
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
                isLast
              />
            </>
          )}
        </SettingsSection>

        <SettingsSection title="Map" description="Choose the base map style, offline packs, and map key management.">
          <View style={styles.appearanceBlock}>
            <MapLayerSelector
              value={mapLayer}
              onChange={(next) => void setSetting('mapLayer', next)}
            />
          </View>
          <View style={styles.appearanceBlock}>
            <ThemedText style={[styles.appearanceLabel, { color: theme.textMuted }]}>Location Dot</ThemedText>
            <LocationDotSelector
              value={locationDotColor}
              onChange={(next) => void setSetting('locationDotColor', next)}
            />
          </View>
          <View style={styles.appearanceBlock}>
            <ThemedText style={[styles.appearanceLabel, { color: theme.textMuted }]}>Map Brightness</ThemedText>
            <BrightnessSelector
              value={mapBrightness}
              onChange={(next) => void setSetting('mapBrightness', next)}
            />
          </View>
          <View style={styles.appearanceBlock}>
            <ThemedText style={[styles.appearanceLabel, { color: theme.textMuted }]}>Map Key</ThemedText>
            <ThemedText style={[styles.apiKeyTitle, { color: theme.text }]}>Need a map key?</ThemedText>
            <ThemedText style={[styles.apiKeyDesc, { color: theme.textMuted }]}>
              CadNav uses MapTiler for tiles. A free key takes about 2 minutes and no credit card is needed. You can also use offline maps without a key.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/manual')}
              accessibilityRole="button"
              accessibilityLabel="Open API key guide"
              style={[styles.apiKeyBtn, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={[styles.apiKeyBtnText, { color: '#fff' }]}>Open API key guide</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => { void Linking.openURL('https://cloud.maptiler.com/account/keys'); }}
              accessibilityRole="button"
              accessibilityLabel="Go to MapTiler keys"
              style={[styles.apiKeyBtn, { backgroundColor: theme.surface, borderColor: theme.divider, borderWidth: StyleSheet.hairlineWidth }]}
            >
              <ThemedText style={[styles.apiKeyBtnText, { color: theme.text }]}>Go to MapTiler keys</ThemedText>
            </Pressable>
          </View>
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

        <SettingsSection title="Location" description="GPS provider priority and power preference. GPS Priority works best in low-reception areas by keeping the satellite lock active.">
          <View style={styles.appearanceBlock}>
            <GpsModeSelector
              value={gpsMode}
              onChange={(next) => void setSetting('gpsMode', next)}
            />
          </View>
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

        <SettingsSection title="Tutorials" description="Replay a guide or open the manual. Green means completed.">
          <TutorialList onOpen={(id) => showTutorial(id)} />
        </SettingsSection>
      </ScrollView>

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
              {/* Mount only while open: closing unmounts AboutContent, which
                  drops its sensor subscriptions (incl. extras) via cleanup. */}
              {infoOpen ? <AboutContent /> : null}
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
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: Radius.xl,
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
  apiKeyTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  apiKeyDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  apiKeyBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  apiKeyBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeModeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  themeModeCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: Radius.lg,
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
  gpsModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gpsModeCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 116,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  themeModeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  mapLayerGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mapLayerCard: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  mapLayerImage: {
    width: '100%',
    height: 72,
  },
  mapLayerBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  mapLayerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapLayerLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  mapLayerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mapLayerDesc: {
    fontSize: 11,
  },
  hsvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  hsvSliders: {
    flex: 1,
    gap: 2,
  },
  sliderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hsvTag: {
    width: 14,
    fontSize: 11,
    fontWeight: '700',
  },
  colorPreview: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dotFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dotReset: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  dotCaption: {
    fontSize: 11,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  brightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  brightValue: {
    width: 44,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    borderRadius: Radius.md,
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
    flexShrink: 1,
    marginLeft: 8,
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
    borderRadius: Radius.xl,
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
  modalScroll: {
    paddingBottom: 20,
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
  tutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 60,
    gap: 12,
  },
  tutorialDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tutorialRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  tutorialRowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  tutorialRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
