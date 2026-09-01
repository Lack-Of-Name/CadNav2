import { Colors } from '@/constants/theme';
import type { CompassRuleResult } from '@/lib/compassRules';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

type Props = {
  visible: boolean;
  onClose: () => void;
  activeRules: CompassRuleResult[];
  allRules?: CompassRuleResult[];
  onRefresh?: () => void;
};

function WarningIcon({ size = 20, bg }: { size?: number; bg: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.8 L21.2 20 H2.8 Z" fill="white" />
      <Path d="M11 8.5 H13 V14 H11 Z" fill={bg} />
      <Path d="M11 16 H13 V18 H11 Z" fill={bg} />
    </Svg>
  );
}

export function CompassWarningSheet({ visible, onClose, activeRules }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const sorted = [...activeRules].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warn: 1, info: 2 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  });

  const hasCritical = sorted.some((r) => r.severity === 'critical');
  const accent = hasCritical ? palette.error : palette.warning;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.divider,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: palette.divider }]} />
          </View>

          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: accent }]}>
              <WarningIcon size={18} bg={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]}>Compass inaccurate</Text>
              <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                {sorted.length === 0 ? 'No issues' : `${sorted.length} ${sorted.length === 1 ? 'issue' : 'issues'} active`}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={[styles.closeBtn, { borderColor: palette.divider, backgroundColor: palette.background }]}
              accessibilityLabel="Close"
            >
              <Text style={[styles.closeText, { color: palette.text }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {sorted.length === 0 ? (
              <Text style={[styles.empty, { color: palette.textMuted }]}>Compass looks reliable here.</Text>
            ) : (
              sorted.map((r) => {
                const dot = r.severity === 'critical' ? palette.error : palette.warning;
                return (
                  <View
                    key={r.id}
                    style={[
                      styles.row,
                      { backgroundColor: palette.background, borderColor: palette.divider },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: dot }]} />
                    <Text style={[styles.rowText, { color: palette.text }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: palette.divider }]}>
            <Pressable
              onPress={onClose}
              style={[styles.dismissBtn, { backgroundColor: palette.text, borderColor: palette.text }]}
            >
              <Text style={[styles.dismissText, { color: palette.surface }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '60%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 12,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: -1,
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  dismissBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
