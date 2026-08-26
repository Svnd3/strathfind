import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppToast } from '@/components/app-toast';
import { AppStateProvider } from '@/state';
import { AppThemeProvider, useAppTheme } from '@/theme/app-theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppStateProvider>
          <ThemedApp />
        </AppStateProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { colors, isDark } = useAppTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(main)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="report-found" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="admin" />
      </Stack>
      <AppToast />
    </>
  );
}
