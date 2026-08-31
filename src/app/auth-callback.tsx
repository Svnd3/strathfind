import { router, useLocalSearchParams, type Href } from 'expo-router';
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
import { sanitizeOAuthReturnTo } from '@/lib/oauth-navigation';
import { type GoogleAuthOutcome, useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

type CallbackResult = { ok: true; data: GoogleAuthOutcome } | { ok: false; error: string };

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
    sb_flow_id?: string | string[];
  }>();
  const { finishOAuthSignIn } = useAppState();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const code = firstParam(params.code);
  const flowId = firstParam(params.sb_flow_id);
  const callbackError = firstParam(params.error) ?? firstParam(params.error_description);
  const [result, setResult] = useState<CallbackResult | null>(null);
  const request = useRef<Promise<CallbackResult> | null>(null);

  useEffect(() => {
    request.current ??= finishOAuthSignIn({ code, flowId, callbackError });
    let active = true;
    void request.current.then((nextResult) => {
      if (active) setResult(nextResult);
    });
    return () => {
      active = false;
    };
  }, [callbackError, code, finishOAuthSignIn, flowId]);

  useEffect(() => {
    if (!result?.ok) return;
    if (result.data.status === 'needs-onboarding') {
      const returnTo = sanitizeOAuthReturnTo(result.data.returnTo);
      router.replace({
        pathname: '/auth-onboarding',
        params: returnTo ? { returnTo } : {},
      });
      return;
    }

    const { user, returnTo } = result.data;
    const destination = user.role === 'admin'
      ? '/admin'
      : (sanitizeOAuthReturnTo(returnTo) ?? '/account');
    router.replace(destination as Href);
  }, [result]);

  const message = useMemo(
    () => (result && !result.ok ? result.error : 'Finishing sign in'),
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
