import React from 'react';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];
type SFSymbolName = React.ComponentProps<typeof SymbolView>['name'];

export const symbolOnIosMaterialOtherwise = (options: {
  iosSymbol: SFSymbolName;
  otherSymbol: MaterialIconName;
  size?: number;
  color?: string;
}): React.ReactElement => {
  const { iosSymbol, otherSymbol, size = 22, color = '#0f172a' } = options;

  return Platform.OS === 'ios' ? (
    <SymbolView name={iosSymbol} size={size} tintColor={color} />
  ) : (
    <MaterialIcons name={otherSymbol} size={size} color={color} />
  );
};
