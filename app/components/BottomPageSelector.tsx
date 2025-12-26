import React, { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../state/ThemeContext';

export const BOTTOM_PAGE_SELECTOR_CLEARANCE_PX = 110;

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
  const { theme } = useAppTheme();
  const barBg = theme.isDark ? theme.colors.background : theme.colors.surface;
  return (
    <View style={styles.shell} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: barBg, borderColor: theme.colors.border }]}>
        {items.map((item, index) => {
          const active = index === activeIndex;
          return (
            <Pressable
              key={item.key}
              style={[styles.tab, active && { backgroundColor: theme.colors.primary }]}
              onPress={() => onSelectIndex(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Go to ${item.label}`}
            >
              <Text style={[styles.tabText, { color: theme.colors.text }, active && { color: theme.colors.onPrimary }]}>
                {item.label}
              </Text>
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
    borderWidth: 1,
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
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
