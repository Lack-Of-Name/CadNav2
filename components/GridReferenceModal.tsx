import React, { useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import StyledButton from './ui/StyledButton';
import { useSettings } from '@/hooks/settings';
import { gridOffsetMetersToLatLon } from './map/mapGrid';
import { useThemeColor } from '@/hooks/use-theme-color';

type GridReferenceModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (location: { latitude: number; longitude: number }) => void;
};

export function GridReferenceModal({ visible, onClose, onAdd }: GridReferenceModalProps) {
  const { mapGridOrigin } = useSettings();
  const [easting, setEasting] = useState('');
  const [northing, setNorthing] = useState('');
  const [error, setError] = useState<string | null>(null);

  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');
  const backgroundColor = useThemeColor({}, 'background');

  function handleAdd() {
    setError(null);
    if (!mapGridOrigin) {
      setError('Map grid origin is not set. Please set it in the Routes settings.');
      return;
    }

    const e = parseFloat(easting);
    const n = parseFloat(northing);

    if (isNaN(e) || isNaN(n)) {
      setError('Please enter valid numbers for Easting and Northing.');
      return;
    }

    const loc = gridOffsetMetersToLatLon(mapGridOrigin, e, n);
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
          
          <ThemedText style={{ marginBottom: 4 }}>Easting (meters)</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="numeric"
            value={easting}
            onChangeText={setEasting}
          />

          <ThemedText style={{ marginBottom: 4, marginTop: 12 }}>Northing (meters)</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="0"
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
    borderRadius: 12,
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
