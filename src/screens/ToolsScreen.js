import { StyleSheet, Text, View } from 'react-native';

function Card({ title, body }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

export default function ToolsScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Tools</Text>
        <Text style={styles.subtitle}>Full-page tools to keep the map uncluttered.</Text>
      </View>

      <View style={styles.grid}>
        <Card title="Checkpoints" body="List • Edit • Import/Export" />
        <Card title="Grid Tools" body="Snap • Rotate • Scale" />
        <Card title="Placement" body="Bearing • Range • Offset" />
        <Card title="Share / Export" body="QR • File • Clipboard" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16
  },
  header: {
    marginTop: 6
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569'
  },
  grid: {
    marginTop: 16,
    gap: 12
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  cardBody: {
    marginTop: 4,
    fontSize: 12,
    color: '#475569'
  }
});
