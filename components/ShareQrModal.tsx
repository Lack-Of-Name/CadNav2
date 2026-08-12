import { useThemeColor } from '@/hooks/use-theme-color';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { alert as showAlert } from './alert';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import StyledButton from './ui/StyledButton';

type ShareQrModalProps = {
  visible: boolean;
  title: string;
  /** Machine-readable deep link encoded into the QR code (cadnav://import…). */
  qrValue: string;
  /** Human-readable text used by the Share button. */
  shareText: string;
  onClose: () => void;
};

export function ShareQrModal({ visible, title, qrValue, shareText, onClose }: ShareQrModalProps) {
  const [shareLabel, setShareLabel] = useState('Share text');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');
  const borderColor = useThemeColor({}, 'tabIconDefault');

  useEffect(() => {
    if (visible) setShareLabel('Share text');
  }, [visible]);

  const handleShareText = useCallback(async () => {
    setShareLabel('Sharing…');
    try {
      await Share.share({ message: shareText, title });
    } catch (error: unknown) {
      void showAlert({
        title: 'Share failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setShareLabel('Share text');
    }
  }, [shareText, title]);

  function close() {
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <ThemedView style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <ThemedText style={[styles.hint, { color: placeholderColor }]}>
            Scan with any phone camera app to import this location.
          </ThemedText>

          <View style={styles.qrFrame}>
            {qrValue.length === 0 ? null : qrValue.length > 2200 ? (
              <View style={styles.qrTooBig}>
                <ThemedText style={styles.qrTooBigTitle}>Too much data for a QR code</ThemedText>
                <ThemedText style={[styles.qrTooBigBody, { color: placeholderColor }]}>
                  This route has too many waypoints to fit in a scannable QR code. Use the
                  Share text button to send it as a message instead.
                </ThemedText>
              </View>
            ) : (
              <QRCode
                value={qrValue}
                size={240}
                color="#000"
                backgroundColor="#fff"
                ecl="M"
                quietZone={12}
              />
            )}
          </View>

          <ThemedText style={[styles.payloadLabel, { color: placeholderColor }]}>
            PAYLOAD
          </ThemedText>
          <ScrollView
            style={[styles.payloadBox, { borderColor, borderWidth: StyleSheet.hairlineWidth }]}
            bounces={false}
          >
            <ThemedText style={[styles.payloadText, { color: textColor }]} selectable>
              {qrValue}
            </ThemedText>
          </ScrollView>

          <View style={styles.buttons}>
            <StyledButton variant="secondary" onPress={close}>Close</StyledButton>
            <View style={{ width: 12 }} />
            <StyledButton variant="primary" onPress={handleShareText}>{shareLabel}</StyledButton>
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
  qrFrame: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 4,
  },
  qrTooBig: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  qrTooBigTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  qrTooBigBody: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  payloadLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 4,
  },
  payloadBox: {
    maxHeight: 110,
    borderRadius: 4,
    padding: 10,
  },
  payloadText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
  },
});
