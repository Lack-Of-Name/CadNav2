import StyledButton from '@/components/ui/StyledButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

const STORAGE_KEY = 'MAPTILER_API_KEY';

type ContextValue = {
  apiKey: string | null;
  loading: boolean;
};

const MapTilerKeyContext = createContext<ContextValue>({ apiKey: null, loading: true });

export function useMapTilerKey() {
  return useContext(MapTilerKeyContext);
}

export function MapTilerKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const ok = await verifyKey(saved);
          if (ok) setApiKey(saved);
          else {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setShowModal(true);
          }
        } else {
          setShowModal(true);
        }
      } catch (e) {
        setShowModal(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function verifyKey(key: string) {
    try {
      const url = `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${key}`;
      const res = await fetch(url, { method: 'GET' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async function onSubmit() {
    if (!input) return Alert.alert('API Key required', 'Please enter your MapTiler API key.');
    setVerifying(true);
    const ok = await verifyKey(input.trim());
    setVerifying(false);
    if (!ok) {
      Alert.alert('Invalid API Key', 'The provided MapTiler API key is invalid. Please check it and try again.');
      return;
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY, input.trim());
      setApiKey(input.trim());
      setShowModal(false);
    } catch (e) {
      Alert.alert('Storage error', 'Failed to save the API key for future launches.');
    }
  }

  return (
    <MapTilerKeyContext.Provider value={{ apiKey, loading }}>
      {children}

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <Text style={styles.title}>MapTiler API Key</Text>
            <Text style={styles.help}>This app needs a free MapTiler API key to load maps.</Text>
            <TextInput
              placeholder="Enter MapTiler API key"
              value={input}
              onChangeText={setInput}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.row}>
              <StyledButton variant="secondary" onPress={() => Linking.openURL('https://www.maptiler.com/')}>
                Get key
              </StyledButton>
              <View style={styles.spacer} />
              <StyledButton variant="primary" onPress={onSubmit} disabled={verifying}>
                {verifying ? <ActivityIndicator color="#fff" /> : 'Verify & Save'}
              </StyledButton>
            </View>
          </View>
        </View>
      </Modal>
    </MapTilerKeyContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  help: {
    marginBottom: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: { width: 12 },
  
});

export default MapTilerKeyProvider;
