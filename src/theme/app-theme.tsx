import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import {
  darkPalette,
  lightPalette,
  type AppPalette,
} from '@/constants/design';
import { readPreference, writePreference } from '@/lib/preferences';

const THEME_PREFERENCE_KEY = 'strathfind-theme-preference';

export type ThemePreference = 'system' | 'light' | 'dark';

interface AppThemeValue {
  colors: AppPalette;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  setDarkMode: (enabled: boolean) => void;
}

const AppThemeContext = createContext<AppThemeValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    void readPreference<unknown>(THEME_PREFERENCE_KEY, 'system').then((stored) => {
      if (active && isThemePreference(stored)) setPreferenceState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void writePreference(THEME_PREFERENCE_KEY, next);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkPalette : lightPalette;

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
      document.body.style.backgroundColor = colors.canvas;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.canvas);
      return;
    }

    void SystemUI.setBackgroundColorAsync(colors.canvas).catch(() => {
      // System chrome support varies by platform and never blocks the app.
    });
  }, [colors.canvas, isDark]);

  const value = useMemo<AppThemeValue>(() => ({
    colors,
    isDark,
    preference,
    setPreference,
    setDarkMode: (enabled: boolean) => setPreference(enabled ? 'dark' : 'light'),
  }), [colors, isDark, preference, setPreference]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return value;
}
