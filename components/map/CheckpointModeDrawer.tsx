import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  visible: boolean;
  onClose: () => void;
  onTap: () => void;
  onGrid: () => void;
  onProject: () => void;
};

function OptionButton({
  icon,
  title,
  subtitle,
  accent,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: theme.surface,
          borderColor: pressed ? accent : theme.divider,
        },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: accent }]}> 
        <IconSymbol name={icon} size={20} color="#fff" />
      </View>
      <View style={styles.optionBody}>
        <Text style={[styles.optionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

export function CheckpointModeDrawer({ visible, onClose, onTap, onGrid, onProject }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(120)}
      style={[styles.shell, { backgroundColor: theme.background, borderColor: theme.divider }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Place checkpoint</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>One target at a time. Tap, grid, or project.</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
          <IconSymbol name="xmark" size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      <View style={styles.options}>
        <OptionButton
          icon="hand.tap.fill"
          title="Tap map"
          subtitle="Drop a temp target where you press"
          accent={theme.tempTarget}
          onPress={onTap}
        />
        <OptionButton
          icon="square.grid.3x3"
          title="Grid ref"
          subtitle="Enter easting and northing"
          accent={theme.primary}
          onPress={onGrid}
        />
        <OptionButton
          icon="safari.fill"
          title="Project"
          subtitle="Bearing and distance from GPS"
          accent={theme.accentOrange}
          onPress={onProject}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 12,
    bottom: 12 + 58 + 58,
    width: '92%',
    maxWidth: 300,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 14,
    zIndex: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  optionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
