import { DenseButton } from '@/components/routes/DenseButton';
import { Colors } from '@/constants/theme';
import { DEFAULT_ROUTE_COLOR, ROUTE_COLORS } from '@/constants/routeColors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

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

export function EditRouteModal({
  visible,
  onClose,
  onSave,
  initialTitle = '',
  initialSubtitle = '',
  initialColor = DEFAULT_ROUTE_COLOR,
  isEditing = false,
}: EditRouteModalProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState<string | null>(null);

  const backgroundColor = useThemeColor({}, 'surface');
  const pageBg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'textSubtle');
  const borderColor = useThemeColor({}, 'divider');
  const iconColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setSubtitle(initialSubtitle);
      setColor(initialColor || DEFAULT_ROUTE_COLOR);
      setError(null);
    }
  }, [visible, initialTitle, initialSubtitle, initialColor]);

  function handleSave() {
    const t = title.trim();
    if (!t) {
      setError('Name is required');
      return;
    }
    onSave(t, subtitle.trim(), '', color);
    onClose();
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); onClose(); }} />
          <TouchableWithoutFeedback onPress={() => Platform.OS !== 'web' && Keyboard.dismiss()} accessible={false}>
            <View
              style={[
                styles.panel,
                { backgroundColor, borderColor, width: isLargeScreen ? 400 : '92%', maxWidth: 440 },
              ]}
            >
              <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <ThemedText style={styles.headerTitle}>{isEditing ? 'EDIT ROUTE' : 'NEW ROUTE'}</ThemedText>
                <TouchableOpacity onPress={onClose} hitSlop={12}>
                  <IconSymbol name="xmark" size={20} color={iconColor} />
                </TouchableOpacity>
              </View>

              <ScrollView
                bounces={false}
                overScrollMode="never"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.form}
              >
                <ThemedText style={[styles.label, { color: theme.textMuted }]}>NAME</ThemedText>
                <TextInput
                  placeholder="e.g. North ridge patrol"
                  value={title}
                  onChangeText={(t) => { setTitle(t); setError(null); }}
                  style={[styles.input, { color: textColor, borderColor, backgroundColor: pageBg }]}
                  placeholderTextColor={placeholderColor}
                  maxLength={80}
                />

                <ThemedText style={[styles.label, { color: theme.textMuted }]}>NOTES</ThemedText>
                <TextInput
                  placeholder="Optional"
                  value={subtitle}
                  onChangeText={setSubtitle}
                  style={[styles.input, { color: textColor, borderColor, backgroundColor: pageBg }]}
                  placeholderTextColor={placeholderColor}
                  maxLength={120}
                />

                <ThemedText style={[styles.label, { color: theme.textMuted }]}>ACCENT</ThemedText>
                <View style={styles.colorRow}>
                  {ROUTE_COLORS.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setColor(c)} activeOpacity={0.8}>
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c, borderColor: theme.divider },
                          color === c && { borderColor: theme.text, borderWidth: 2 },
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {error ? (
                  <ThemedText style={{ color: theme.error, fontSize: 12 }}>{error}</ThemedText>
                ) : null}

                <View style={styles.footer}>
                  <DenseButton label="Cancel" colorScheme={colorScheme} onPress={onClose} style={styles.footerBtn} />
                  <DenseButton
                    label={isEditing ? 'Save' : 'Create'}
                    variant="primary"
                    accentColor={color}
                    colorScheme={colorScheme}
                    onPress={handleSave}
                    style={styles.footerBtn}
                  />
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  form: {
    padding: 14,
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  footerBtn: {
    flex: 1,
  },
});
