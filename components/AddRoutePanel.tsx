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
  { id: 'reference', label: 'Reference', icon: 'book.fill' },
  { id: 'project', label: 'Project', icon: 'arrow.up.square.fill' },
  { id: 'place', label: 'Place', icon: 'mappin.and.ellipse' },
  { id: 'saved', label: 'Saved', icon: 'star.fill' },
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
                <ThemedText type="subtitle">Add to Route</ThemedText>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <IconSymbol name="xmark" size={24} color={iconColor} />
                </TouchableOpacity>
            </View>
            
            <View style={styles.grid}>
                {OPTIONS.map((opt) => (
                    <TouchableOpacity 
                        key={opt.id} 
                        style={[styles.option, { backgroundColor: cardColor }]} 
                        onPress={() => onSelect(opt.id)}
                    >
                        <View style={styles.iconContainer}>
                             <IconSymbol name={opt.icon as any} size={32} color={iconColor} />
                        </View>
                        <ThemedText style={styles.optionLabel}>{opt.label}</ThemedText>
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
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeButton: {
    padding: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  option: {
    width: '47%',
    aspectRatio: 1.2,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    marginBottom: 12,
  },
  optionLabel: {
    fontWeight: '600',
    fontSize: 16,
  },
});
