import { useThemeColor } from '@/hooks/use-theme-color';
import { latLonToMGRS } from '@/lib/mgrs';
import type { Checkpoint } from '@/types';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import StyledButton from './ui/StyledButton';

type EditCheckpointModalProps = {
  visible: boolean;
  checkpoint: Checkpoint | null;
  onClose: () => void;
  onSaveLabel: (label: string) => void;
  onReposition: (mode: 'tap' | 'grid' | 'project') => void;
};

export function EditCheckpointModal({ visible, checkpoint, onClose, onSaveLabel, onReposition }: EditCheckpointModalProps) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');

  useEffect(() => {
    if (visible) {
      setLabel(checkpoint?.label ?? '');
      setError(null);
    }
  }, [visible, checkpoint]);

  function close() {
    Keyboard.dismiss();
    onClose();
  }

  function save() {
    if (!checkpoint) return;
    setError(null);
    const trimmed = label.trim();
    if (trimmed.length > 40) {
      setError('Name must be 40 characters or fewer.');
      return;
    }
    onSaveLabel(trimmed);
    onClose();
  }

  function reposition(mode: 'tap' | 'grid' | 'project') {
    if (!checkpoint) return;
    Keyboard.dismiss();
    onReposition(mode);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); close(); }} />
          <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
            <ThemedText type="subtitle">Edit Checkpoint</ThemedText>
            <ThemedText style={[styles.hint, { color: placeholderColor }]}>
              Change the name or move the checkpoint with a placement method.
            </ThemedText>

            {checkpoint ? (
              <View style={[styles.current, { borderColor, backgroundColor: 'rgba(128,128,128,0.1)' }]}>
                <ThemedText style={styles.currentLabel}>CURRENT POSITION</ThemedText>
                <ThemedText style={[styles.currentValue, { color: textColor }]} numberOfLines={1}>
                  {checkpoint.mgrs?.trim() || latLonToMGRS(checkpoint.latitude, checkpoint.longitude, 5)}
                </ThemedText>
                <ThemedText style={[styles.currentSub, { color: placeholderColor }]}>
                  {checkpoint.latitude.toFixed(5)}, {checkpoint.longitude.toFixed(5)}
                </ThemedText>
              </View>
            ) : null}

            <ThemedText style={styles.fieldLabel}>Name</ThemedText>
            <TextInput
              style={[styles.input, { color: textColor, borderColor }]}
              placeholder="Checkpoint name"
              placeholderTextColor={placeholderColor}
              value={label}
              onChangeText={(t) => { setLabel(t); setError(null); }}
              maxLength={40}
              autoFocus
            />

            <ThemedText style={styles.fieldLabel}>Reposition</ThemedText>
            <View style={styles.modeCol}>
              <TouchableOpacity
                style={[styles.modeBtn, { borderColor, backgroundColor: borderColor }]}
                onPress={() => reposition('tap')}
              >
                <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Tap Map</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, { borderColor, backgroundColor: borderColor }]}
                onPress={() => reposition('grid')}
              >
                <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Grid Reference</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, { borderColor, backgroundColor: borderColor }]}
                onPress={() => reposition('project')}
              >
                <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Project Point</ThemedText>
              </TouchableOpacity>
            </View>

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <View style={styles.buttons}>
              <StyledButton variant="secondary" onPress={close}>Cancel</StyledButton>
              <View style={{ width: 12 }} />
              <StyledButton variant="primary" onPress={save}>Save</StyledButton>
            </View>
          </ThemedView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  hint: {
    fontSize: 12,
    marginBottom: 14,
  },
  current: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.6,
    marginBottom: 2,
  },
  currentValue: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  currentSub: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  modeCol: {
    gap: 8,
  },
  modeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  error: {
    color: 'red',
    marginTop: 12,
  },
});
