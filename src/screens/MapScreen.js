import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const MapView = Platform.OS === 'web' ? null : require('react-native-maps').default;

export default function MapScreen() {
  return (
    <View style={styles.root}>
      {Platform.OS === 'web' ? (
        <View style={styles.mapCanvas}>
          <View style={styles.webFallback} pointerEvents="none">
            <Text style={styles.webFallbackTitle}>Map (web)</Text>
            <Text style={styles.webFallbackText}>
              Native map is enabled for iOS/Android via react-native-maps.
            </Text>
          </View>
        </View>
      ) : (
        <MapView
          style={styles.mapNative}
          initialRegion={{
            latitude: 51.5074,
            longitude: -0.1278,
            latitudeDelta: 0.09,
            longitudeDelta: 0.09
          }}
          rotateEnabled
          pitchEnabled
        />
      )}

      <View style={styles.leftPill} pointerEvents="none">
        <Text style={styles.pillTitle}>Map</Text>
        <Text style={styles.pillText}>Offline • GPS: unknown</Text>
      </View>

      <View style={styles.rightStack} pointerEvents="none">
        <View style={styles.rightPill}>
          <Text style={styles.pillText}>Grid: Off</Text>
        </View>
        <View style={styles.rightPill}>
          <Text style={styles.pillText}>Compass: Free</Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.actionBar}>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionText}>Center</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionText}>Add CP</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionText}>Measure</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  mapCanvas: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mapNative: {
    ...StyleSheet.absoluteFillObject
  },
  webFallback: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    maxWidth: 320
  },
  webFallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  webFallbackText: {
    marginTop: 6,
    fontSize: 12,
    color: '#475569'
  },
  leftPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rightStack: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8
  },
  rightPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pillTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  pillText: {
    marginTop: 2,
    fontSize: 12,
    color: '#334155'
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    paddingHorizontal: 16
  },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 8,
    maxWidth: 420,
    width: '100%'
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  }
});
