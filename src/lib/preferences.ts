import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function readPreference<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(key)
      : await SecureStore.getItemAsync(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export async function writePreference<T>(key: string, value: T) {
  try {
    const serialized = JSON.stringify(value);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, serialized);
    else await SecureStore.setItemAsync(key, serialized);
  } catch {
    // Preferences enhance the experience but never block core reporting.
  }
}
