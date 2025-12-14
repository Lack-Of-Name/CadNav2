import React, { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CardProps {
  title: string;
  body: string;
}

const Card: FC<CardProps> = ({ title, body }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
};

const ToolsScreen: FC = () => {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Tools</Text>
        <Text style={styles.subtitle}>Full-page tools to keep the map uncluttered.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map actions</Text>
        <View style={styles.actionsRow}>
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

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>Grid: Off</Text>
          <Text style={styles.statusDivider}>•</Text>
          <Text style={styles.statusText}>Compass: Free</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Card title="Checkpoints" body="List • Edit • Import/Export" />
        <Card title="Grid Tools" body="Snap • Rotate • Scale" />
        <Card title="Placement" body="Bearing • Range • Offset" />
        <Card title="Share / Export" body="QR • File • Clipboard" />
      </View>
    </View>
  );
};

export default ToolsScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  header: {
    marginTop: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569',
  },
  grid: {
    marginTop: 16,
    gap: 12,
  },
  section: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#475569',
  },
  statusDivider: {
    fontSize: 12,
    color: '#94a3b8',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardBody: {
    marginTop: 4,
    fontSize: 12,
    color: '#475569',
  },
});
