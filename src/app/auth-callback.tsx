import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  BrandLockup,
  ContentShell,
  PrimaryButton,
  RouteLoadingScreen,
  Screen,
  Surface,
} from '@/components/strathfind';
import { layout, spacing, type AppPalette } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

type CallbackResult = { ok: true; userId: string } | { ok: false; message: string };

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function finishEmailAuth(code?: string, callbackError?: string): Promise<CallbackResult> {
  if (callbackError) {
    return { ok: false, message: 'This confirmation link could not be completed.' };
  }
  if (!supabase) {
    return { ok: false, message: 'Authentication is not configured for this build.' };
  }

  if (code) {
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && exchangeData.session) return { ok: true, userId: exchangeData.session.user.id };
    return { ok: false, message: 'This confirmation link is invalid or has expired.' };
  }

  const { data, error } = await supabase.auth.getSession();
  if (!error && data.session) return { ok: true, userId: data.session.user.id };
  return { ok: false, message: 'This confirmation link is invalid or has expired.' };
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const { loading, user } = useAppState();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const code = firstParam(params.code);
  const callbackError = firstParam(params.error) ?? firstParam(params.error_description);
  const [result, setResult] = useState<CallbackResult | null>(null);
  const request = useRef<Promise<CallbackResult> | null>(null);

  useEffect(() => {
    request.current ??= finishEmailAuth(code, callbackError);
    let active = true;
    void request.current.then((nextResult) => {
      if (active) setResult(nextResult);
    });
    return () => {
      active = false;
    };
  }, [callbackError, code]);

  useEffect(() => {
    if (result?.ok && !loading && user?.id === result.userId) {
      router.replace(user.role === 'admin' ? '/admin' : '/account');
    }
  }, [loading, result, user]);

  useEffect(() => {
    if (!result?.ok || user?.id === result.userId) return;
    const timeout = setTimeout(() => {
      setResult({
        ok: false,
        message: 'Your email was confirmed, but the campus profile could not be loaded. Try signing in again.',
      });
    }, 12_000);
    return () => clearTimeout(timeout);
  }, [result, user?.id]);

  const message = useMemo(
    () => (result && !result.ok ? result.message : 'Finishing sign in'),
    [result],
  );

  if (!result || result.ok) return <RouteLoadingScreen label={message} />;

  return (
    <Screen edges={['top', 'right', 'bottom', 'left']} scrollable={false}>
      <ContentShell maxWidth={layout.readingMax} style={styles.shell}>
        <BrandLockup markSize={42} />
        <Surface padding="lg" style={styles.card}>
          <View style={styles.copy}>
            <AppText accessibilityRole="header" variant="h2">Link not completed</AppText>
            <AppText accessibilityLiveRegion="polite" color={colors.muted} variant="body">
              {message}
            </AppText>
          </View>
          <PrimaryButton fullWidth onPress={() => router.replace('/auth')}>Back to sign in</PrimaryButton>
        </Surface>
      </ContentShell>
    </Screen>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    shell: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.lg,
      backgroundColor: colors.canvas,
    },
    card: {
      gap: spacing.lg,
    },
    copy: {
      gap: spacing.sm,
    },
  });
}
