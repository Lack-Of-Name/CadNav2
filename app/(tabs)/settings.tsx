import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { getMaplibreModule } from '@/lib/maplibreModule';
import { useCheckpoints } from '@/hooks/checkpoints';
import { useSettings, type GpsMode, type ThemeMode } from '@/hooks/settings';
import { tutorials } from '@/constants/tutorials';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTutorials } from '@/hooks/tutorials';
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
    <View style={styles.themeModeGrid}>
      {GPS_MODE_CHOICES.map((choice) => {
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
            <ThemedText style={[styles.themeModeLabel, { color: active ? 'rgba(255,255,255,0.7)' : theme.textMuted, fontSize: 11 }]}>{choice.desc}</ThemedText>
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
  const { angleUnit, mapHeading, mapLayer, mapGridEnabled, mapGridSubdivisionsEnabled, mapGridNumbersEnabled, themeMode, gpsMode, setSetting } = useSettings();
  const { apiKey, clearApiKey } = useMapTilerKey();
  const { showTutorial, hasCompleted } = useTutorials();
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
          />
          <SettingsRow
            icon="questionmark.circle.fill"
            label="Tutorials"
            color={theme.primary}
            onPress={() => {}}
            rightElement={
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                {tutorials.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => showTutorial(t.id)}
                    style={[styles.tutorialBadge, { backgroundColor: hasCompleted(t.id) ? theme.success + '30' : theme.warning + '30', borderColor: hasCompleted(t.id) ? theme.success : theme.warning }]}
                  >
                    <Text style={[styles.tutorialBadgeText, { color: hasCompleted(t.id) ? theme.success : theme.warning }]}>{t.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
            isLast
          />
        </SettingsSection>

        <ThemedText style={styles.footerText}>CadNav v1.0.0 · Grid navigation for field use</ThemedText>
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
  tutorialBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tutorialBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
