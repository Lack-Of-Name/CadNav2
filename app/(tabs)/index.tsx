
import MapLibreMap from '@/components/map/MaplibreMap';
import SimpleNavView from '@/components/map/SimpleNavView';
import { useSetting } from '@/hooks/settings';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const [gpsMode] = useSetting('gpsMode');

  if (gpsMode === 'super') {
    return <SimpleNavView />;
  }

  return (
    <View style={styles.container}>
      <MapLibreMap />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
