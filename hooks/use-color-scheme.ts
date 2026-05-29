import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useSettings } from '@/hooks/settings';

export function useColorScheme() {
	const systemColorScheme = useSystemColorScheme() ?? 'light';
	const { themeMode } = useSettings();

	return themeMode === 'system' ? systemColorScheme : themeMode;
}
