import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppToast } from '@/components/app-toast';
import { palette } from '@/constants/design';
import { AppStateProvider } from '@/state';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.canvas },
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
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
