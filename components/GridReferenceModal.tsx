import { useSettings } from '@/hooks/settings';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { gridCoordsToLatLon } from './map/mapGrid';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import StyledButton from './ui/StyledButton';

type GridReferenceModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (location: { latitude: number; longitude: number }) => void;
};

export function GridReferenceModal({ visible, onClose, onAdd }: GridReferenceModalProps) {
  const { mapGridOrigin, gridConvergence } = useSettings();
  const [easting, setEasting] = useState('');
  const [northing, setNorthing] = useState('');
  const [error, setError] = useState<string | null>(null);

  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');

  function parseGridValue(value: string) {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) return null;
    const len = trimmed.length;
    if (len < 1 || len > 5) return null;
    const scaleByDigits: Record<number, number> = {
      1: 10000,
      2: 1000,
      3: 100,
      4: 10,
      5: 1,
    };
    const scale = scaleByDigits[len];
    const num = parseInt(trimmed, 10);
    return { meters: num * scale, digits: len };
  }

  function handleAdd() {
    setError(null);
    if (!mapGridOrigin) {
      setError('Map grid origin is not set. Please set it in the Routes settings.');
      return;
    }

    const eParsed = parseGridValue(easting);
    const nParsed = parseGridValue(northing);

    if (!eParsed || !nParsed) {
      setError('Enter grid digits only (1–5 digits each).');
      return;
    }

    if (eParsed.digits !== nParsed.digits) {
      setError('Easting and Northing must have the same number of digits (1–5).');
      return;
    }

    const loc = gridCoordsToLatLon(mapGridOrigin, eParsed.meters, nParsed.meters, gridConvergence ?? 0);
    onAdd(loc);
    reset();
  }

  function reset() {
    setEasting('');
    setNorthing('');
    setError(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={reset}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Add by Grid Reference</ThemedText>
          
          <ThemedText style={{ marginBottom: 4 }}>Easting (grid digits)</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="e.g. 12"
            placeholderTextColor={placeholderColor}
            keyboardType="numeric"
            value={easting}
            onChangeText={setEasting}
          />

          <ThemedText style={{ marginBottom: 4, marginTop: 12 }}>Northing (grid digits)</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="e.g. 34"
            placeholderTextColor={placeholderColor}
            keyboardType="numeric"
            value={northing}
            onChangeText={setNorthing}
          />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <View style={styles.buttons}>
            <StyledButton variant="secondary" onPress={reset}>Cancel</StyledButton>
            <View style={{ width: 12 }} />
            <StyledButton variant="primary" onPress={handleAdd}>Add Point</StyledButton>
          </View>
        </ThemedView>
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
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 14,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
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
