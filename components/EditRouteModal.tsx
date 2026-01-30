import { useThemeColor } from '@/hooks/use-theme-color';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { EmojiPicker } from './EmojiPicker';
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
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const iconColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setSubtitle(initialSubtitle);
      setIcon(initialIcon);
      setColor(initialColor);
      setError(null);
    }
  }, [visible, initialTitle, initialSubtitle, initialIcon, initialColor]);

  function extractEmoji(s: string) {
    try {
      const m = s.match(/\p{Extended_Pictographic}/u);
      return m ? m[0] : '';
    } catch {
      return s.replace(/[\w\d\s]/g, '').slice(0, 2);
    }
  }

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
                <View style={styles.iconRow}>
                    <TouchableOpacity onPress={() => setEmojiPickerVisible(true)}>
                        <View style={[styles.iconPreview, { borderColor }]}>
                            <ThemedText style={{ fontSize: 32 }}>{icon || '?'}</ThemedText>
                        </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Icon (Emoji)</ThemedText>
                        <TextInput
                            placeholder="e.g. 🧭"
                            value={icon}
                            onChangeText={(t) => {
                                const e = extractEmoji(t);
                                if (e) setIcon(e);
                                else setIcon('');
                                setError(null);
                            }}
                            style={[styles.input, { color: textColor, borderColor }]}
                            placeholderTextColor={placeholderColor}
                            maxLength={2}
                            autoCorrect={false}
                        />
                    </View>
                </View>

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
                    <StyledButton variant="primary" onPress={handleSave}>{isEditing ? 'Save Changes' : 'Create Route'}</StyledButton>
                </View>
            </View>
        </Animated.View>
      </View>
      <EmojiPicker 
        visible={emojiPickerVisible} 
        onClose={() => setEmojiPickerVisible(false)} 
        onSelect={(emoji) => { setIcon(emoji); setError(null); }} 
      />
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
    gap: 16,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
  },
  iconPreview: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
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
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
  },
  colorDotSelected: {
    borderWidth: 3,
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
