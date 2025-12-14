import React, { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type PageSelectorItem = {
  key: string;
  label: string;
};

interface BottomPageSelectorProps {
  items: PageSelectorItem[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
}

const BottomPageSelector: FC<BottomPageSelectorProps> = ({ items, activeIndex, onSelectIndex }) => {
  return (
    <View style={styles.shell} pointerEvents="box-none">
      <View style={styles.bar}>
        {items.map((item, index) => {
          const active = index === activeIndex;
          return (
            <Pressable
              key={item.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => onSelectIndex(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Go to ${item.label}`}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default BottomPageSelector;

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    padding: 8,
    maxWidth: 460,
    width: '100%',
  },
  tab: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#0f172a',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  tabTextActive: {
    color: '#ffffff',
  },
});
