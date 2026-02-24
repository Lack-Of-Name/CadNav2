import { useSettings } from '@/hooks/settings';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useState } from 'react';
import { Modal, StyleSheet, TextInput, View, TouchableOpacity } from 'react-native';
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
  const [eastingSign, setEastingSign] = useState<1 | -1>(1);
  const [northingSign, setNorthingSign] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);

  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');

  function parseGridValue(value: string, sign: 1 | -1) {
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
    return { meters: num * scale * sign, digits: len };
  }

  function handleAdd() {
    setError(null);
    if (!mapGridOrigin) {
      setError('Map grid origin is not set. Please set it in the Routes settings.');
      return;
    }

    const eParsed = parseGridValue(easting, eastingSign);
    const nParsed = parseGridValue(northing, northingSign);

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
    setEastingSign(1);
    setNorthingSign(1);
    setError(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={reset}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Add by Grid Reference</ThemedText>
          
          <ThemedText style={{ marginBottom: 4 }}>Easting (grid digits)</ThemedText>
          <View style={[styles.inputContainer, { borderColor }]}>
            <TouchableOpacity 
              style={[styles.signButton, { borderRightColor: borderColor }]} 
              onPress={() => setEastingSign(s => s === 1 ? -1 : 1)}
            >
              <ThemedText style={styles.signText}>{eastingSign === 1 ? '+' : '-'}</ThemedText>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="e.g. 12"
              placeholderTextColor={placeholderColor}
              keyboardType="numeric"
              value={easting}
              onChangeText={(t) => { setEasting(t.replace(/[^0-9]/g, '')); setError(null); }}
              maxLength={5}
            />
          </View>

          <ThemedText style={{ marginBottom: 4, marginTop: 12 }}>Northing (grid digits)</ThemedText>
          <View style={[styles.inputContainer, { borderColor }]}>
            <TouchableOpacity 
              style={[styles.signButton, { borderRightColor: borderColor }]} 
              onPress={() => setNorthingSign(s => s === 1 ? -1 : 1)}
            >
              <ThemedText style={styles.signText}>{northingSign === 1 ? '+' : '-'}</ThemedText>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="e.g. 34"
              placeholderTextColor={placeholderColor}
              keyboardType="numeric"
              value={northing}
              onChangeText={(t) => { setNorthing(t.replace(/[^0-9]/g, '')); setError(null); }}
              maxLength={5}
            />
          </View>

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
  inputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  signButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  signText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    padding: 12,
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
