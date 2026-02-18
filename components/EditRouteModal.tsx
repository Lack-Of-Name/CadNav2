import { useThemeColor } from '@/hooks/use-theme-color';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';
import StyledButton from './ui/StyledButton';

type EditRouteModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, subtitle: string, icon: string, color: string) => void;
  initialTitle?: string;
  initialSubtitle?: string;
  initialIcon?: string;
  initialColor?: string;
  isEditing?: boolean;
};

const ROUTE_COLORS = [
  '#34C759',
  '#0A84FF',
  '#64D2FF',
  '#FFD60A',
  '#FF9F0A',
  '#FF453A',
  '#BF5AF2',
  '#5E5CE6',
] as const;

// Curated quick-pick emojis for route icons - the most useful for navigation
const QUICK_EMOJIS = [
  '📍','🚩','🏁','🧭','🗺️','🏔️','⛰️','🏕️','⛺',
  '🏠','🏢','🏥','🏰','⛪','🌲','🌳','🌊','🏖️',
  '🅿️','⛽','🚗','🚶','🏃','🚴','🚵','🚣','🏊',
  '⭐','🔥','💧','❄️','⚡','🔴','🟢','🔵',
  '🟡','🟠','🟣','⚪','🦅','🐻','🐟',
  '☀️','🌙','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟',
] as const;

export function EditRouteModal({ 
  visible, 
  onClose, 
  onSave, 
  initialTitle = '', 
  initialSubtitle = '', 
  initialIcon = '📍',
  initialColor = ROUTE_COLORS[0],
  isEditing = false 
}: EditRouteModalProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState<string | null>(null);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const iconColor = useThemeColor({}, 'text');
  const selectedBg = useThemeColor({ light: '#e8e8ea', dark: '#3a3a3c' }, 'background');

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setSubtitle(initialSubtitle);
      setIcon(initialIcon);
      setColor(initialColor);
      setError(null);
    }
  }, [visible, initialTitle, initialSubtitle, initialIcon, initialColor]);

  function handleSave() {
    const t = title.trim();
    const ic = icon.trim();
    
    if (!t) {
      setError('Title is required');
      return;
    }
    if (!ic) {
      setError('Icon is required');
      return;
    }

    onSave(t, subtitle.trim(), ic, color);
    onClose();
  }

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
                <ThemedText type="subtitle">{isEditing ? 'Edit Route' : 'New Route'}</ThemedText>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <IconSymbol name="xmark" size={24} color={iconColor} />
                </TouchableOpacity>
            </View>

            <View style={styles.form}>
                {/* Icon picker - inline scroll strip */}
                <ThemedText style={styles.label}>Icon</ThemedText>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emojiStrip}
                  style={styles.emojiStripContainer}
                >
                  {QUICK_EMOJIS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      onPress={() => { setIcon(e); setError(null); }}
                      style={[
                        styles.emojiOption,
                        icon === e && { backgroundColor: selectedBg, borderColor: color, borderWidth: 2 },
                      ]}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={{ fontSize: 26 }}>{e}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ThemedText style={styles.label}>Title</ThemedText>
                <TextInput 
                    placeholder="Route Name" 
                    value={title} 
                    onChangeText={(t) => { setTitle(t); setError(null); }} 
                    style={[styles.input, { color: textColor, borderColor }]} 
                    placeholderTextColor={placeholderColor} 
                    maxLength={80} 
                />

                <ThemedText style={styles.label}>Subtitle (Optional)</ThemedText>
                <TextInput 
                    placeholder="Description or notes" 
                    value={subtitle} 
                    onChangeText={(t) => { setSubtitle(t); setError(null); }} 
                    style={[styles.input, { color: textColor, borderColor }]} 
                    placeholderTextColor={placeholderColor} 
                    maxLength={120} 
                />

                <ThemedText style={styles.label}>Route Color</ThemedText>
                <View style={styles.colorRow}>
                  {ROUTE_COLORS.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setColor(c)}>
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: c, borderColor },
                          color === c && styles.colorDotSelected,
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

                <View style={styles.footer}>
                    <StyledButton variant="secondary" onPress={onClose}>Cancel</StyledButton>
                    <View style={{ width: 12 }} />
                    <StyledButton variant="primary" onPress={handleSave} color={color}>{isEditing ? 'Save Changes' : 'Create Route'}</StyledButton>
                </View>
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
    marginBottom: 24,
  },
  closeButton: {
    padding: 4,
    opacity: 0.7,
  },
  form: {
    gap: 12,
  },
  emojiStripContainer: {
    maxHeight: 54,
  },
  emojiStrip: {
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  emojiOption: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scale: 1.15 }],
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
});
