import { useThemeColor } from '@/hooks/use-theme-color';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

type UnfinishedBadgeProps = {
  label?: string;
};

export function UnfinishedBadge({ label = 'UNFINISHED' }: UnfinishedBadgeProps) {
  const textColor = useThemeColor({}, 'error');
  const bgColor = useThemeColor({ light: 'rgba(234,67,53,0.08)', dark: 'rgba(234,67,53,0.12)' }, 'background');
  const borderColor = useThemeColor({}, 'tabIconDefault');

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
