import { useCheckpoints } from '@/hooks/checkpoints';
import { useGPS } from '@/hooks/gps';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useState } from 'react';
import { Modal, StyleSheet, Switch, TextInput, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import StyledButton from './ui/StyledButton';
// If geolib is not available, I'll implement a simple projection function.
// Checking package.json... I don't see geolib. I'll implement a simple spherical projection.

type ProjectPointModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (location: { latitude: number; longitude: number }) => void;
};

// Simple spherical projection
function projectPoint(start: { latitude: number; longitude: number }, distanceMeters: number, bearingDegrees: number) {
    const R = 6371e3; // Earth radius in meters
    const d = distanceMeters;
    const brng = (bearingDegrees * Math.PI) / 180;
    const lat1 = (start.latitude * Math.PI) / 180;
    const lon1 = (start.longitude * Math.PI) / 180;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));

    return {
        latitude: (lat2 * 180) / Math.PI,
        longitude: (lon2 * 180) / Math.PI,
    };
}

export function ProjectPointModal({ visible, onClose, onAdd }: ProjectPointModalProps) {
  const { lastLocation } = useGPS();
  const { checkpoints } = useCheckpoints(); // Assuming we can get checkpoints to find the last one
  // Actually useCheckpoints returns { selectedCheckpoint, ... } but maybe not the full list directly exposed in the hook return?
  // Let's check hooks/checkpoints.tsx again. It returns { ...store } which includes checkpoints.
  
  const [distance, setDistance] = useState('');
  const [bearing, setBearing] = useState('');
  const [useLastCheckpoint, setUseLastCheckpoint] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');

  const lastCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  const canUseCheckpoint = !!lastCheckpoint;
  const canUseGPS = !!lastLocation;

  // Default to GPS if no checkpoint
  if (!canUseCheckpoint && useLastCheckpoint && canUseGPS) {
      setUseLastCheckpoint(false);
  }

  function handleAdd() {
    setError(null);
    const d = parseFloat(distance);
    const bMils = parseFloat(bearing);

    if (isNaN(d) || isNaN(bMils)) {
      setError('Please enter valid numbers.');
      return;
    }

    let startPoint = null;
    if (useLastCheckpoint && lastCheckpoint) {
        startPoint = { latitude: lastCheckpoint.latitude, longitude: lastCheckpoint.longitude };
    } else if (lastLocation) {
        startPoint = { latitude: lastLocation.coords.latitude, longitude: lastLocation.coords.longitude };
    }

    if (!startPoint) {
        setError('No starting point available (GPS or Checkpoint).');
        return;
    }

    // Convert mils to degrees (6400 mils = 360 degrees)
    const bDeg = (bMils * 360) / 6400;

    const newLoc = projectPoint(startPoint, d, bDeg);
    onAdd(newLoc);
    reset();
  }

  function reset() {
    setDistance('');
    setBearing('');
    setError(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={reset}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Project Point</ThemedText>
          
          <View style={styles.row}>
            <ThemedText>From Last Checkpoint</ThemedText>
            <Switch 
                value={useLastCheckpoint} 
                onValueChange={setUseLastCheckpoint} 
                disabled={!canUseCheckpoint}
            />
          </View>
          <ThemedText style={styles.hint}>
            {useLastCheckpoint 
                ? (lastCheckpoint ? `Using CP #${checkpoints.length}` : 'No checkpoints available') 
                : (lastLocation ? 'Using Current GPS Location' : 'No GPS location available')}
          </ThemedText>

          <ThemedText style={{ marginBottom: 4, marginTop: 12 }}>Distance (meters)</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="numeric"
            value={distance}
            onChangeText={setDistance}
          />

          <ThemedText style={{ marginBottom: 4, marginTop: 12 }}>Bearing (mils)</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor }]}
            placeholder="0" // 6400 mils circle
            placeholderTextColor={placeholderColor}
            keyboardType="numeric"
            value={bearing}
            onChangeText={setBearing}
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
  row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  hint: {
      fontSize: 12,
      opacity: 0.7,
      marginBottom: 8,
  }
});
