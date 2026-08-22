import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const HAPTICS_KEY = 'strathfind.haptics-enabled.v1';
let enabled: boolean | undefined;

async function readEnabled() {
  if (enabled !== undefined) return enabled;
  try {
    const value = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(HAPTICS_KEY)
      : await SecureStore.getItemAsync(HAPTICS_KEY);
    enabled = value !== 'false';
  } catch {
    enabled = true;
  }
  return enabled;
}

async function nativeOnly(action: () => Promise<void>) {
  if (Platform.OS === 'web' || !(await readEnabled())) return;
  try {
    await action();
  } catch {
    // Haptics are an enhancement and should never block the task.
  }
}

export const haptics = {
  select: () => nativeOnly(() => Haptics.selectionAsync()),
  press: () => nativeOnly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  confirm: () => nativeOnly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => nativeOnly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  isEnabled: readEnabled,
  setEnabled: async (value: boolean) => {
    enabled = value;
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(HAPTICS_KEY, String(value));
      else await SecureStore.setItemAsync(HAPTICS_KEY, String(value));
    } catch {
      // A preference write must not block the interface.
    }
  },
};
