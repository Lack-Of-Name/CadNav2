/**
 * AttributionChip — compact, always-visible map attribution.
 *
 * MapTiler's ToS and the OpenStreetMap ODbL both require visible attribution
 * for map tiles. The built-in MapLibre logo is disabled (logoEnabled={false})
 * so we can render our own chip that fits the app's field-kit aesthetic and
 * links out to the data sources.
 *
 * Place one in the bottom-left corner of any MapView (the conventional spot),
 * and let it expand into a small popover when tapped.
 */
import { ThemedText } from '@/components/themed-text';
import { HUD } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

type Props = {
  /** Bypasses the safe-area left inset when false (default true). */
  respectInset?: boolean;
  /** Left offset in px (use insets.left when positioning manually). */
  left?: number;
  /** Bottom offset in px (use insets.bottom when positioning manually). */
  bottom?: number;
};

const MAPTILER_URL = 'https://www.maptiler.com/';
const OSM_URL = 'https://www.openstreetmap.org/copyright';
const MAPTILER_LICENSE_URL = 'https://www.maptiler.com/terms-of-use/';

export function AttributionChip({ left = 0, bottom = 0 }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const [expanded, setExpanded] = useState(false);

  // Close the popover if the app is backgrounded while open.
  useEffect(() => {
    if (!expanded) return;
  }, [expanded]);

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.anchor, { left: 8 + left, bottom: 8 + bottom }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Map attribution — MapTiler and OpenStreetMap. Tap for details."
          accessibilityHint="Opens data source and licensing information."
          onPress={() => setExpanded(true)}
          style={[
            styles.chip,
            {
              backgroundColor: colorScheme === 'dark' ? 'rgba(15,18,12,0.78)' : 'rgba(255,255,255,0.88)',
              borderColor: colorScheme === 'dark' ? HUD.border : 'rgba(0,0,0,0.12)',
            },
          ]}
        >
          <ThemedText style={styles.chipText}>© MapTiler</ThemedText>
          <View style={[styles.chipSep, { backgroundColor: colorScheme === 'dark' ? HUD.tick : 'rgba(0,0,0,0.15)' }]} />
          <ThemedText style={styles.chipText}>© OSM</ThemedText>
          <View style={styles.infoDot}>
            <ThemedText style={styles.infoDotText}>i</ThemedText>
          </View>
        </Pressable>
      </View>

      <Modal visible={expanded} animationType="fade" transparent onRequestClose={() => setExpanded(false)}>
        <Pressable style={styles.backdrop} onPress={() => setExpanded(false)}>
          <View
            style={[
              styles.popover,
              {
                backgroundColor: colorScheme === 'dark' ? HUD.bg : '#fff',
                borderColor: colorScheme === 'dark' ? HUD.border : 'rgba(0,0,0,0.1)',
              },
            ]}
          >
            <Pressable style={styles.popoverBody}>
              <ThemedText style={styles.popoverTitle}>Map data &amp; attribution</ThemedText>

              <View style={styles.sourceRow}>
                <ThemedText style={styles.sourceLabel}>Tiles</ThemedText>
                <ThemedText style={styles.sourceValue}>© MapTiler</ThemedText>
              </View>
              <View style={styles.sourceRow}>
                <ThemedText style={styles.sourceLabel}>Map data</ThemedText>
                <ThemedText style={styles.sourceValue}>© OpenStreetMap contributors</ThemedText>
              </View>
              <View style={styles.sourceRow}>
                <ThemedText style={styles.sourceLabel}>Elevation</ThemedText>
                <ThemedText style={styles.sourceValue}>MapTiler elevation API</ThemedText>
              </View>

              <ThemedText style={styles.finePrint}>
                Map tiles are loaded from MapTiler and built from OpenStreetMap
                contributor data, both licensed for reuse under their respective terms.
              </ThemedText>

              <View style={styles.linkRow}>
                <Pressable
                  style={[styles.linkBtn, { borderColor: colorScheme === 'dark' ? HUD.border : 'rgba(0,0,0,0.15)' }]}
                  onPress={() => open(MAPTILER_URL)}
                >
                  <ThemedText style={styles.linkBtnText}>MapTiler</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.linkBtn, { borderColor: colorScheme === 'dark' ? HUD.border : 'rgba(0,0,0,0.15)' }]}
                  onPress={() => open(OSM_URL)}
                >
                  <ThemedText style={styles.linkBtnText}>OpenStreetMap</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.linkBtn, { borderColor: colorScheme === 'dark' ? HUD.border : 'rgba(0,0,0,0.15)' }]}
                  onPress={() => open(MAPTILER_LICENSE_URL)}
                >
                  <ThemedText style={styles.linkBtnText}>Terms of use</ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  chipSep: {
    width: 1,
    height: 9,
  },
  infoDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.28)',
    marginLeft: 2,
  },
  infoDotText: {
    fontSize: 9,
    fontWeight: '800',
    opacity: 0.8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popover: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  popoverBody: {
    gap: 0,
  },
  popoverTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  sourceLabel: {
    fontSize: 13,
    opacity: 0.6,
  },
  sourceValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  finePrint: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.6,
    marginTop: 14,
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
