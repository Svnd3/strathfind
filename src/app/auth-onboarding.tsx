import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GoogleMark } from '@/components/google-mark';
import {
  AppText,
  BrandLockup,
  ContentShell,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Surface,
  TextButton,
  TextField,
} from '@/components/strathfind';
import { focusRing, hoverShadow, radius, spacing, type AppPalette } from '@/constants/design';
import {
  CURRENT_PRIVACY_NOTICE_VERSION,
  CURRENT_TERMS_VERSION,
} from '@/lib/legal';
import { sanitizeOAuthReturnTo } from '@/lib/oauth-navigation';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanDisplayValue(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 160);
}

function safeReturnHref(value: unknown): Href | null {
  const safePath = sanitizeOAuthReturnTo(value);
  return safePath ? safePath as Href : null;
}

export default function AuthOnboardingScreen() {
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const { completeGoogleOnboarding, loading, signOut, user } = useAppState();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const returnTo = useMemo(() => safeReturnHref(firstParam(params.returnTo)), [params.returnTo]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [universityCode, setUniversityCode] = useState('');
  const [campusId, setCampusId] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsFocused, setTermsFocused] = useState(false);
  const [termsHovered, setTermsHovered] = useState(false);
  const [action, setAction] = useState<'complete' | 'cancel' | null>(null);
  const [error, setError] = useState('');
  const busy = loading || action !== null;

  useEffect(() => {
    let active = true;
    if (!supabase) {
      router.replace('/auth');
      return () => {
        active = false;
      };
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session?.user) {
        router.replace('/auth');
        return;
      }
      const authUser = data.session.user;
      const providers = authUser.app_metadata?.providers;
      const usesGoogle = authUser.app_metadata?.provider === 'google'
        || (Array.isArray(providers) && providers.includes('google'));
      if (!usesGoogle) {
        router.replace('/auth');
        return;
      }
      const metadata = authUser.user_metadata ?? {};
      const suggestedName = [metadata.full_name, metadata.name, metadata.display_name]
        .map(cleanDisplayValue)
        .find(Boolean) ?? '';
      setEmail(cleanDisplayValue(authUser.email));
      if (suggestedName) setName((current) => current || suggestedName);
    }).catch(() => {
      // The completion action performs the authoritative session check.
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    router.replace(user.role === 'admin' ? '/admin' : returnTo ?? '/account');
  }, [returnTo, user]);

  const submit = async () => {
    setError('');
    if (!acceptedTerms) {
      setError('Accept the Terms and Privacy Notice to continue.');
      return;
    }

    setAction('complete');
    try {
      const result = await completeGoogleOnboarding({
        name,
        phone,
        campusId,
        universityCode,
        acceptedTerms,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace(result.data.role === 'admin' ? '/admin' : returnTo ?? '/account');
    } catch {
      setError('Your student profile could not be completed. Try again.');
    } finally {
      setAction(null);
    }
  };

  const cancel = async () => {
    setError('');
    setAction('cancel');
    try {
      await signOut();
      router.replace(returnTo
        ? ({ pathname: '/auth', params: { mode: 'sign-in', returnTo: String(returnTo) } } as Href)
        : '/auth');
    } catch {
      setError('Sign out could not be completed. Try again.');
    } finally {
      setAction(null);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ContentShell maxWidth={680} style={styles.shell}>
        <View style={styles.topbar}>
          <BrandLockup markSize={40} />
        </View>

        <View style={styles.body}>
          <Surface padding="xl" style={styles.formCard}>
            <View style={styles.formHeading}>
              <AppText accessibilityRole="header" variant="h1">Finish your student profile</AppText>
              <View style={styles.googleIdentity}>
                <GoogleMark size={18} />
                <AppText color={colors.inkSoft} numberOfLines={1} style={styles.identityText} variant="support">
                  {email || 'Google account connected'}
                </AppText>
              </View>
            </View>

            <View style={styles.fields}>
              <TextField
                autoComplete="name"
                editable={!busy}
                label="Full name"
                onChangeText={setName}
                placeholder="Your name"
                value={name}
              />
              <TextField
                autoCapitalize="characters"
                editable={!busy}
                label="University code"
                onChangeText={setUniversityCode}
                placeholder="Invitation code"
                value={universityCode}
              />
              <TextField
                autoCapitalize="characters"
                editable={!busy}
                label="Student number"
                onChangeText={setCampusId}
                placeholder="Campus ID"
                value={campusId}
              />
              <TextField
                autoComplete="tel"
                editable={!busy}
                inputMode="tel"
                keyboardType="phone-pad"
                label="Mobile number"
                onChangeText={setPhone}
                onSubmitEditing={() => void submit()}
                placeholder="e.g. 0712 345 678"
                value={phone}
              />
            </View>

            <View style={styles.termsRow}>
              <Pressable
                accessibilityHint={`Terms version ${CURRENT_TERMS_VERSION}; Privacy Notice version ${CURRENT_PRIVACY_NOTICE_VERSION}`}
                accessibilityLabel="Accept the Terms and acknowledge the Privacy Notice"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms, disabled: busy }}
                disabled={busy}
                onBlur={() => setTermsFocused(false)}
                onFocus={() => setTermsFocused(true)}
                onHoverIn={() => setTermsHovered(true)}
                onHoverOut={() => setTermsHovered(false)}
                onPress={() => {
                  setAcceptedTerms((current) => !current);
                  setError('');
                }}
                style={[
                  styles.checkboxHitTarget,
                  busy && styles.controlDisabled,
                  focusRing(termsFocused, colors.wine),
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptedTerms && styles.checkboxChecked,
                    hoverShadow(termsHovered && !busy, colors.black),
                  ]}
                >
                  {acceptedTerms ? <Check color={colors.onPrimary} size={16} strokeWidth={3} /> : null}
                </View>
              </Pressable>
              <View style={styles.termsCopy}>
                <AppText color={colors.inkSoft} variant="support">
                  I accept the Terms and acknowledge the Privacy Notice.
                </AppText>
                <TextButton
                  accessibilityHint={`Current Terms: ${CURRENT_TERMS_VERSION}. Privacy Notice: ${CURRENT_PRIVACY_NOTICE_VERSION}.`}
                  disabled={busy}
                  onPress={() => router.push('/legal')}
                  style={styles.termsLink}
                >
                  Read Terms &amp; Privacy
                </TextButton>
              </View>
            </View>

            {error ? (
              <AppText accessibilityLiveRegion="polite" color={colors.danger} variant="support">
                {error}
              </AppText>
            ) : null}

            <View style={styles.actions}>
              <PrimaryButton
                disabled={action === 'cancel'}
                fullWidth
                loading={action === 'complete' || (loading && action !== 'cancel')}
                onPress={() => void submit()}
              >
                Finish setup
              </PrimaryButton>
              <SecondaryButton
                disabled={busy && action !== 'cancel'}
                fullWidth
                loading={action === 'cancel'}
                onPress={() => void cancel()}
              >
                Cancel &amp; sign out
              </SecondaryButton>
            </View>
          </Surface>
        </View>
      </ContentShell>
    </Screen>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    shell: { flex: 1 },
    topbar: { minHeight: 80, alignItems: 'flex-start', justifyContent: 'center' },
    body: { flex: 1, minHeight: 620, justifyContent: 'center', paddingVertical: spacing.xl },
    formCard: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: spacing.lg },
    formHeading: { gap: spacing.sm },
    googleIdentity: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.inset,
    },
    identityText: { flex: 1 },
    fields: { gap: spacing.md },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    checkboxHitTarget: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
    },
    checkbox: {
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: colors.line,
      backgroundColor: colors.surfaceStrong,
    },
    checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
    controlDisabled: { opacity: 0.48 },
    termsCopy: { flex: 1, alignItems: 'flex-start', gap: spacing.xxs },
    termsLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
    actions: { gap: spacing.sm },
  });
}
