import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function Collapsible({ children, title, header }: PropsWithChildren & { title?: string; header?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useColorScheme() ?? 'light';

  return (
    <ThemedView style={{ width: '100%' }}>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}>
        {header ? (
          <>
            <ThemedView style={{ flex: 1 }}>{header}</ThemedView>
            <IconSymbol
              name="chevron.right"
              size={18}
              weight="medium"
              color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
              style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }], marginLeft: 8 }}
            />
          </>
        ) : (
          <>
            <IconSymbol
              name="chevron.right"
              size={18}
              weight="medium"
              color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
              style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
            />

            <ThemedText type="defaultSemiBold">{title}</ThemedText>
          </>
        )}
      </TouchableOpacity>
      {isOpen && <ThemedView style={styles.content}>{children}</ThemedView>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  content: {
    marginTop: 6,
  },
});
