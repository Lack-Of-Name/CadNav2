import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  message: string;
  /** Called after the fade-out animation finishes. */
  onHide: () => void;
};

export function Toast({ message, onHide }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onHideRef.current();
      });
    }, 1400);

    return () => clearTimeout(timer);
  }, [opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 14, opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.pill}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 70,
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
