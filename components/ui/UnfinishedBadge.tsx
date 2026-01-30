import { useThemeColor } from '@/hooks/use-theme-color';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

type UnfinishedBadgeProps = {
  label?: string;
};

export function UnfinishedBadge({ label = 'UNFINISHED' }: UnfinishedBadgeProps) {
  const textColor = useThemeColor({ light: '#8A2C2C', dark: '#F6B1B1' }, 'text');
  const bgColor = useThemeColor({ light: 'rgba(255, 214, 214, 0.95)', dark: 'rgba(125, 30, 30, 0.6)' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(210, 90, 90, 0.5)', dark: 'rgba(246, 177, 177, 0.35)' }, 'tabIconDefault');

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}> 
      <ThemedText style={[styles.text, { color: textColor }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
