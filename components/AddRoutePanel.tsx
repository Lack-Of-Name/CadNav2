import { useThemeColor } from '@/hooks/use-theme-color';
import { Modal, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

type AddRoutePanelProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: string) => void;
};

const OPTIONS = [
  { 
    id: 'place', 
    label: 'Place on Map', 
    desc: 'Tap to drop a pin', 
    color: '#34C759', // Green
    icon: 'mappin.and.ellipse' 
  },
  { 
    id: 'reference', 
    label: 'Grid Reference', 
    desc: 'Enter grid coordinates', 
    color: '#007AFF', // Blue
    icon: 'square.grid.3x3' 
  },
  { 
    id: 'project', 
    label: 'Project Point', 
    desc: 'From bearing & distance', 
    color: '#AF52DE', // Purple
    icon: 'safari.fill' 
  },
  { 
    id: 'saved', 
    label: 'Saved Items', 
    desc: 'Load from library', 
    color: '#FF9500', // Orange
    icon: 'folder.fill' 
  },
] as const;

export function AddRoutePanel({ visible, onClose, onSelect }: AddRoutePanelProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const iconColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  // Use a slightly different background for the cards to make them pop
  const cardColor = useThemeColor({ light: '#f5f5f5', dark: '#252525' }, 'background');

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View 
            entering={SlideInDown.springify().damping(15)} 
            exiting={SlideOutDown}
            style={[
                styles.panel, 
                { backgroundColor, width: isLargeScreen ? 400 : '90%' }
            ]}
        >
            <View style={styles.header}>
                <ThemedText type="subtitle">Add Waypoint</ThemedText>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <IconSymbol name="xmark" size={24} color={iconColor} />
                </TouchableOpacity>
            </View>
            
            <View style={styles.grid}>
                {OPTIONS.map((opt) => (
                    <TouchableOpacity 
                        key={opt.id} 
                        style={[
                          styles.option,
                          { backgroundColor: cardColor },
                        ]}
                        onPress={() => onSelect(opt.id)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: opt.color }]}>
                             <IconSymbol name={opt.icon as any} size={24} color="#fff" />
                        </View>
                        <View style={styles.textContainer}>
                            <ThemedText style={styles.optionLabel}>{opt.label}</ThemedText>
                            <ThemedText style={styles.optionDesc}>{opt.desc}</ThemedText>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 4,
    opacity: 0.7,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  option: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 110,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  textContainer: {
    width: '100%',
  },
  optionLabel: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    opacity: 0.6,
    lineHeight: 16,
  },
});
