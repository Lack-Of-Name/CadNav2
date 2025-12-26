import React, { FC, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useCadNav } from '../state/CadNavContext';
import { usePager } from '../state/PagerContext';
import { AppTheme, AppThemeId, useAppTheme } from '../state/ThemeContext';

interface CardProps {
  title: string;
  body: string;
}

const Card: FC<CardProps> = ({ title, body }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
};

const SettingsScreen: FC = () => {
  const { theme, themeId, setThemeId } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { enterMapDownloadMode, offlineMapMode, setOfflineMapMode, baseMap, setBaseMap, offlineTiles } = useCadNav();
  const { goToPage } = usePager();

  const progressPct = useMemo(() => {
    if (offlineTiles.total <= 0) return 0;
    return Math.max(0, Math.min(1, offlineTiles.completed / offlineTiles.total));
  }, [offlineTiles.completed, offlineTiles.total]);

  const [showProgressBar, setShowProgressBar] = useState(false);

  const themeOptions = useMemo(
    () =>
      [
        { id: 'light' as const, label: 'Light' },
        { id: 'dark' as const, label: 'Dark' },
        { id: 'retroLight' as const, label: 'Retro Light' },
        { id: 'retroDark' as const, label: 'Retro Dark' },
      ],
    []
  );

  useEffect(() => {
    if (offlineTiles.status === 'downloading') {
      setShowProgressBar(true);
      return;
    }
    if (offlineTiles.status === 'ready' || offlineTiles.status === 'error') {
      setShowProgressBar(true);
      const t = setTimeout(() => setShowProgressBar(false), 2200);
      return () => clearTimeout(t);
    }
  }, [offlineTiles.status]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>App preferences and permissions.</Text>
      </View>

      <View style={styles.grid}>
        <Card title="Permissions" body="Location • Camera • Storage" />
        <Card title="Preferences" body="Units • Grid defaults • Map defaults" />
        <Card title="About" body="CadNav 2 • v0.0.0" />
        <Card title="Data" body="Local-only (offline-first)" />

        <Pressable
          style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Download maps"
          onPress={() => {
            enterMapDownloadMode();
            goToPage(0, { animated: true });
          }}
        >
          <Text style={styles.downloadButtonText}>Download maps</Text>
          <Text style={styles.downloadButtonSubtext}>Select an area on the map to save for offline use</Text>
        </Pressable>

        {showProgressBar && (
          <View style={styles.progressShell}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.round(progressPct * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {offlineTiles.status === 'downloading'
                ? `Downloading maps: ${offlineTiles.completed}/${offlineTiles.total}${offlineTiles.failed ? ` (failed ${offlineTiles.failed})` : ''}`
                : offlineTiles.status === 'ready'
                  ? 'Download complete'
                  : offlineTiles.status === 'error'
                    ? (offlineTiles.error ?? 'Download error')
                    : ''}
            </Text>
          </View>
        )}

        <View style={styles.switchRow}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchTitle}>Offline mode</Text>
            <Text style={styles.switchSubtext}>When enabled, the map uses only downloaded tiles (no network maps)</Text>
          </View>
          <Switch
            value={offlineMapMode === 'offline'}
            onValueChange={(next) => setOfflineMapMode(next ? 'offline' : 'online')}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={offlineMapMode === 'offline' ? theme.colors.onPrimary : undefined}
          />
        </View>

        <View style={styles.selectorCard}>
          <Text style={styles.selectorTitle}>Theme</Text>
          <View style={styles.selectorRowWrap}>
            {themeOptions.map((opt) => {
              const active = themeId === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${opt.label} theme`}
                  style={({ pressed }) => [
                    styles.selectorOptionHalf,
                    (active || pressed) && styles.selectorOptionActive,
                  ]}
                  onPress={() => setThemeId(opt.id as AppThemeId)}
                >
                  <Text style={[styles.selectorOptionText, active && styles.selectorOptionTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.selectorSubtext}>Light, Dark, and Retro accent variants.</Text>
        </View>

        <View style={styles.selectorCard}>
          <Text style={styles.selectorTitle}>Map style</Text>
          <View style={styles.selectorRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use OpenStreetMap"
              style={({ pressed }) => [styles.selectorOption, (baseMap === 'osm' || pressed) && styles.selectorOptionActive]}
              onPress={() => setBaseMap('osm')}
            >
              <Text style={[styles.selectorOptionText, baseMap === 'osm' && styles.selectorOptionTextActive]}>OSM</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use Esri World Imagery"
              style={({ pressed }) => [styles.selectorOption, (baseMap === 'esriWorldImagery' || pressed) && styles.selectorOptionActive]}
              onPress={() => setBaseMap('esriWorldImagery')}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  baseMap === 'esriWorldImagery' && styles.selectorOptionTextActive,
                ]}
              >
                Esri imagery
              </Text>
            </Pressable>
          </View>
          <Text style={styles.selectorSubtext}>
            Offline mode always uses local tiles. Note: OSM public tiles may block bulk/offline usage.
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SettingsScreen;

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  header: {
    marginTop: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  grid: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cardBody: {
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  downloadButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  downloadButtonPressed: {
    backgroundColor: theme.colors.surfacePressed,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  downloadButtonSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  switchTextCol: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  switchSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  progressShell: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.colors.border,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
  },
  progressText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },

  selectorCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  selectorRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  selectorRowWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectorOption: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  selectorOptionHalf: {
    width: '48%',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  selectorOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectorOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  selectorOptionTextActive: {
    color: theme.colors.onPrimary,
  },
  selectorSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
