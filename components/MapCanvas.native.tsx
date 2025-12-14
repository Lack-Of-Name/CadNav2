import React from 'react';
import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

export default function MapCanvas() {
  return (
    <MapView
      style={styles.root}
      initialRegion={{
        latitude: -36.9962,
        longitude: 145.0272,
        latitudeDelta: 0.09,
        longitudeDelta: 0.09,
      }}
      rotateEnabled
      pitchEnabled
    />
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
});
