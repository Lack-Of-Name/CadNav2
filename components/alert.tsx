import { Alert, Platform } from 'react-native';

export type AlertButton = {
	text: string;
	style?: 'default' | 'cancel' | 'destructive';
	onPress?: () => void | Promise<void>;
};

export async function alert(
	opts: {
		title?: string;
		message?: string;
		buttons?: AlertButton[];
		cancelable?: boolean;
	} = {}
) {
	const { title = '', message = '', buttons } = opts;

	if (Platform.OS === 'web') {
		// No buttons: simple alert
		if (!buttons || buttons.length === 0) {
			window.alert(message || title);
			return;
		}

		// Single button: show alert then call handler
		if (buttons.length === 1) {
			window.alert(message || title);
			if (buttons[0].onPress) await buttons[0].onPress();
			return;
		}

		// Two buttons with a cancel style -> use confirm
		const cancelIndex = buttons.findIndex((b) => b.style === 'cancel');
		if (buttons.length === 2 && cancelIndex !== -1) {
			const ok = window.confirm(message || title);
			if (!ok) return;
			const other = buttons[1 - cancelIndex];
			if (other.onPress) await other.onPress();
			return;
		}

		// Fallback: use confirm, call first non-cancel (or first) on OK
		const ok = window.confirm(message || title);
		if (!ok) return;
		const first = buttons.find((b) => b.style !== 'cancel') || buttons[0];
		if (first.onPress) await first.onPress();
		return;
	}

	// Native: map buttons directly to Alert.alert
	const nativeButtons = (buttons && buttons.length > 0)
		? buttons.map((b) => ({
				text: b.text,
				style: b.style as any,
				onPress: () => {
					try {
						const res = b.onPress?.();
						if (res && typeof (res as any).then === 'function') void res;
					} catch (err) {
						Alert.alert('Alert handler error', String(err));
					}
				},
			}))
		: [{ text: 'OK', onPress: undefined }];

	Alert.alert(title ?? '', message ?? '', nativeButtons as any, { cancelable: opts.cancelable ?? true });
}