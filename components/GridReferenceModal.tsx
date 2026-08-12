import { useGPS } from '@/hooks/gps';
import { mgrsAreaString, mgrsToLatLon } from '@/lib/mgrs';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import StyledButton from './ui/StyledButton';

type GridReferenceModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (location: { latitude: number; longitude: number }, mgrs: string) => void;
};

// GZD: UTM zone 1-60 (1-2 digits) plus latitude band letter C-X (I and O omitted).
const GZD_RE = /^[0-9]{1,2}[C-HJ-NP-X]$/;
// 100km square: column letter A-Z (I/O omitted) then row letter A-V (I/O omitted).
const SQUARE_RE = /^[A-HJ-NP-Z][A-HJ-NP-V]$/;
const DIGITS_MIN = 3;
const DIGITS_MAX = 5;

const ACCURACY: Record<number, string> = {
  3: '100 m',
  4: '10 m',
  5: '1 m',
};

export function GridReferenceModal({ visible, onClose, onAdd }: GridReferenceModalProps) {
  const { lastLocation } = useGPS();
  const [gzd, setGzd] = useState('');
  const [square, setSquare] = useState('');
  const [easting, setEasting] = useState('');
  const [northing, setNorthing] = useState('');
  const [error, setError] = useState<string | null>(null);

  const gzdRef = useRef<TextInput>(null);
  const squareRef = useRef<TextInput>(null);
  const eastingRef = useRef<TextInput>(null);
  const northingRef = useRef<TextInput>(null);

  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');

  const digits = easting.length === northing.length ? easting.length : null;
  const accuracy = digits !== null && digits >= DIGITS_MIN && digits <= DIGITS_MAX ? ACCURACY[digits] : null;

  const fillFromGps = useCallback(() => {
    if (!lastLocation) {
      setError('No GPS location available yet. Try again once GPS is ready.');
      return false;
    }
    const { latitude, longitude } = lastLocation.coords;
    const area = mgrsAreaString(latitude, longitude);
    const match = area.match(/^([0-9]{1,2}[A-Z]) ([A-Z]{2})$/);
    if (!match) return false;
    setGzd(match[1]);
    setSquare(match[2]);
    setError(null);
    return true;
  }, [lastLocation]);

  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    setError(null);
    if (wasVisibleRef.current) return;
    wasVisibleRef.current = true;
    if (!gzd && !square) {
      const filled = fillFromGps();
      // Focus the first field that still needs input (after the modal animation).
      setTimeout(() => {
        if (filled) eastingRef.current?.focus();
        else gzdRef.current?.focus();
      }, 300);
    }
  }, [visible, gzd, square, fillFromGps]);

  const fullReference = (() => {
    if (!gzd.trim() || !square.trim() || !easting.trim() || !northing.trim()) return null;
    return `${gzd.trim().toUpperCase()} ${square.trim().toUpperCase()} ${easting} ${northing}`;
  })();

  function handleAdd() {
    setError(null);
    const gzdClean = gzd.trim().toUpperCase();
    const squareClean = square.trim().toUpperCase();

    if (!GZD_RE.test(gzdClean)) {
      setError('GZD: zone number 1–60 plus band letter C–X, e.g. "55H" or "4Q".');
      return;
    }
    if (!SQUARE_RE.test(squareClean)) {
      setError('100km square must be two letters (A–Z, no I or O), e.g. "DV".');
      return;
    }
    if (!/^[0-9]+$/.test(easting) || !/^[0-9]+$/.test(northing)) {
      setError('Easting and northing must be numbers.');
      return;
    }
    if (easting.length !== northing.length) {
      setError('Easting and northing must have the same number of digits.');
      return;
    }
    if (easting.length < DIGITS_MIN || easting.length > DIGITS_MAX) {
      setError(`Easting and northing must each be ${DIGITS_MIN}-${DIGITS_MAX} digits (100 m / 10 m / 1 m).`);
      return;
    }

    const ref = `${gzdClean} ${squareClean} ${easting} ${northing}`;
    const loc = mgrsToLatLon(ref);
    if (!loc) {
      setError('That grid reference could not be converted. Check the GZD and 100km square.');
      return;
    }

    onAdd({ latitude: loc.latitude, longitude: loc.longitude }, ref);
    reset();
  }

  function reset() {
    setEasting('');
    setNorthing('');
    setGzd('');
    setSquare('');
    setError(null);
    Keyboard.dismiss();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={reset}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); reset(); }} />
          <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 4 }}>Add by Grid Reference</ThemedText>
            <ThemedText style={[styles.hint, { color: placeholderColor }]}>
              Easting before northing — read right, then up. e.g. 55H DV 123 456
            </ThemedText>

            <View style={styles.labelRow}>
              <ThemedText style={styles.fieldLabel}>GZD</ThemedText>
              <ThemedText style={styles.fieldLabel}>Square</ThemedText>
              <ThemedText style={styles.fieldLabel}>Easting</ThemedText>
              <ThemedText style={styles.fieldLabel}>Northing</ThemedText>
            </View>

            <View style={[styles.segmentRow, { borderColor }]}>
              <TextInput
                ref={gzdRef}
                style={[styles.segment, { color: textColor }]}
                placeholder="55H"
                placeholderTextColor={placeholderColor}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                selectTextOnFocus
                maxLength={3}
                value={gzd}
                onChangeText={(t) => {
                  const clean = t.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 3);
                  setGzd(clean);
                  setError(null);
                  if (clean.length === 3) squareRef.current?.focus();
                }}
                onSubmitEditing={() => squareRef.current?.focus()}
                returnKeyType="next"
              />
              <TextInput
                ref={squareRef}
                style={[styles.segment, styles.segmentDivider, { color: textColor, borderLeftColor: borderColor }]}
                placeholder="DV"
                placeholderTextColor={placeholderColor}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                selectTextOnFocus
                maxLength={2}
                value={square}
                onChangeText={(t) => {
                  const clean = t.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
                  setSquare(clean);
                  setError(null);
                  if (clean.length === 2) eastingRef.current?.focus();
                }}
                onSubmitEditing={() => eastingRef.current?.focus()}
                returnKeyType="next"
              />
              <TextInput
                ref={eastingRef}
                style={[styles.segment, styles.segmentDivider, { color: textColor, borderLeftColor: borderColor }]}
                placeholder="123"
                placeholderTextColor={placeholderColor}
                keyboardType="number-pad"
                autoCorrect={false}
                spellCheck={false}
                selectTextOnFocus
                maxLength={DIGITS_MAX}
                value={easting}
                onChangeText={(t) => {
                  const clean = t.replace(/[^0-9]/g, '').slice(0, DIGITS_MAX);
                  setEasting(clean);
                  setError(null);
                  if (clean.length === DIGITS_MAX) northingRef.current?.focus();
                }}
              />
              <TextInput
                ref={northingRef}
                style={[styles.segment, styles.segmentDivider, { color: textColor, borderLeftColor: borderColor }]}
                placeholder="456"
                placeholderTextColor={placeholderColor}
                keyboardType="number-pad"
                autoCorrect={false}
                spellCheck={false}
                selectTextOnFocus
                maxLength={DIGITS_MAX}
                value={northing}
                onChangeText={(t) => {
                  const clean = t.replace(/[^0-9]/g, '').slice(0, DIGITS_MAX);
                  setNorthing(clean);
                  setError(null);
                  if (clean.length === DIGITS_MAX) Keyboard.dismiss();
                }}
              />
            </View>

            <TouchableOpacity onPress={fillFromGps} hitSlop={6}>
              <ThemedText style={[styles.gpsHint, { color: textColor }]}>
                {lastLocation
                  ? 'Use my GPS location to fill the GZD / square'
                  : 'Waiting for GPS location…'}
              </ThemedText>
            </TouchableOpacity>

            {fullReference ? (
              <View style={[styles.preview, { borderColor, backgroundColor: 'rgba(128,128,128,0.1)' }]}>
                <ThemedText style={styles.previewLabel}>REFERENCE</ThemedText>
                <ThemedText style={[styles.previewValue, { color: textColor }]}>{fullReference}</ThemedText>
                <ThemedText style={[styles.previewAcc, { color: placeholderColor }]}>
                  {accuracy
                    ? `${accuracy} grid accuracy`
                    : digits !== null
                      ? 'Easting and northing need the same 3–5 digits'
                      : 'Enter 3–5 digit easting and northing'}
                </ThemedText>
              </View>
            ) : null}

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <View style={styles.buttons}>
              <StyledButton variant="secondary" onPress={reset}>Cancel</StyledButton>
              <View style={{ width: 12 }} />
              <StyledButton variant="primary" onPress={handleAdd}>Add Point</StyledButton>
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
  labelRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 16,
  },
  segmentDivider: {
    borderLeftWidth: 1,
  },
  gpsHint: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  preview: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.6,
    marginBottom: 2,
  },
  previewValue: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  previewAcc: {
    fontSize: 12,
    marginTop: 2,
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