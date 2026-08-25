import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  BrandLockup,
  ContentShell,
  PrimaryButton,
  Screen,
  Surface,
  TextButton,
  TextField,
} from '@/components/strathfind';
import { focusRing, palette, radius, spacing } from '@/constants/design';
import type { UserRole } from '@/lib/types';
import { useAppState } from '@/state';

type FormMode = 'sign-in' | 'sign-up';

function safeReturnTo(value: string | undefined): Href | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value === '/auth' || value.startsWith('/auth?')) return null;
  return value as Href;
}

export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const { loading, mode: dataMode, signIn, signUp } = useAppState();
  const [formMode, setFormMode] = useState<FormMode>(params.mode === 'sign-up' ? 'sign-up' : 'sign-in');
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [campusId, setCampusId] = useState('');
  const [universityCode, setUniversityCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsFocused, setTermsFocused] = useState(false);
  const [error, setError] = useState('');

  const navigateAfterAuth = (nextRole: UserRole) => {
    if (nextRole === 'admin') {
      router.replace('/admin');
      return;
    }
    router.replace(safeReturnTo(params.returnTo) ?? '/account');
  };

  const selectMode = (nextMode: FormMode) => {
    setFormMode(nextMode);
    setRole('student');
    setError('');
  };

  const submit = async () => {
    setError('');
    if (dataMode === 'setup') {
      setError('Secure accounts are not connected yet.');
      return;
    }

    if (formMode === 'sign-in') {
      const result = await signIn({ email, password, role });
      if (!result.ok) return setError(result.error);
      navigateAfterAuth(result.data.role);
      return;
    }

    if (!acceptedTerms) {
      setError('Accept the Terms and Privacy Notice to continue.');
      return;
    }
    const result = await signUp({
      name,
      email,
      phone,
      campusId,
      universityCode,
      password,
      acceptedTerms,
    });
    if (!result.ok) return setError(result.error);
    if (result.data) navigateAfterAuth('student');
  };

  const title = formMode === 'sign-up'
    ? 'Create account'
    : role === 'admin'
      ? 'Admin sign in'
      : 'Sign in';

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ContentShell maxWidth={680} style={styles.shell}>
        <View style={styles.topbar}>
          <TextButton icon={ArrowLeft} onPress={() => router.back()} style={styles.topbarAction}>Back</TextButton>
          <BrandLockup markSize={40} />
        </View>

        <View style={styles.body}>
          <Surface padding="xl" style={styles.formCard}>
            <View style={styles.formHeading}>
              <AppText accessibilityRole="header" variant="h1">{title}</AppText>
              {role === 'admin' && formMode === 'sign-in' ? (
                <View style={styles.adminLabel}>
                  <LockKeyhole color={palette.wine} size={17} />
                  <AppText color={palette.inkSoft} variant="support">Invite only</AppText>
                </View>
              ) : null}
            </View>

            {dataMode === 'setup' ? (
              <View style={styles.setupNotice}>
                <ShieldCheck color={palette.warning} size={20} />
                <AppText color={palette.warning} style={{ flex: 1 }} variant="support">
                  Secure sign-in activates after Supabase is connected.
                </AppText>
              </View>
            ) : null}

            <View style={styles.fields}>
              {formMode === 'sign-up' ? (
                <>
                  <TextField autoComplete="name" label="Full name" onChangeText={setName} placeholder="Your name" value={name} />
                  <TextField
                    autoCapitalize="characters"
                    label="University code"
                    onChangeText={setUniversityCode}
                    placeholder="Invitation code"
                    value={universityCode}
                  />
                  <TextField
                    autoCapitalize="characters"
                    label="Student number"
                    onChangeText={setCampusId}
                    placeholder="Campus ID"
                    value={campusId}
                  />
                </>
              ) : null}

              <TextField
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                keyboardType="email-address"
                label="University email"
                onChangeText={setEmail}
                placeholder="name@strathmore.edu"
                value={email}
              />

              {formMode === 'sign-up' ? (
                <TextField
                  autoComplete="tel"
                  inputMode="tel"
                  keyboardType="phone-pad"
                  label="Mobile number"
                  onChangeText={setPhone}
                  placeholder="+254 7…"
                  value={phone}
                />
              ) : null}

              <TextField
                autoCapitalize="none"
                autoComplete={formMode === 'sign-up' ? 'new-password' : 'current-password'}
                label="Password"
                onChangeText={setPassword}
                onSubmitEditing={() => void submit()}
                placeholder={formMode === 'sign-up' ? 'At least 8 characters' : 'Your password'}
                secureTextEntry={!showPassword}
                value={password}
                trailing={(
                  <Pressable
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityRole="button"
                    onPress={() => setShowPassword((current) => !current)}
                    style={styles.passwordToggle}
                  >
                    {showPassword
                      ? <EyeOff color={palette.muted} size={20} />
                      : <Eye color={palette.muted} size={20} />}
                  </Pressable>
                )}
              />
            </View>

            {formMode === 'sign-up' ? (
              <View style={styles.termsRow}>
                <Pressable
                  accessibilityLabel="Accept the Terms and acknowledge the Privacy Notice"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  onBlur={() => setTermsFocused(false)}
                  onFocus={() => setTermsFocused(true)}
                  onPress={() => setAcceptedTerms((current) => !current)}
                  style={[styles.checkbox, acceptedTerms && styles.checkboxChecked, focusRing(termsFocused)]}
                >
                  {acceptedTerms ? <Check color={palette.white} size={18} strokeWidth={3} /> : null}
                </Pressable>
                <View style={styles.termsCopy}>
                  <AppText color={palette.inkSoft} variant="support">
                    I accept the Terms and acknowledge the Privacy Notice.
                  </AppText>
                  <TextButton onPress={() => router.push('/legal')} style={styles.termsLink}>Read them</TextButton>
                </View>
              </View>
            ) : (
              <TextButton onPress={() => router.push('/legal')} style={styles.legalLink}>
                Terms &amp; privacy
              </TextButton>
            )}

            {error ? (
              <AppText accessibilityLiveRegion="polite" color={palette.danger} variant="support">{error}</AppText>
            ) : null}

            <PrimaryButton
              disabled={dataMode === 'setup' || (formMode === 'sign-up' && !acceptedTerms)}
              fullWidth
              loading={loading}
              onPress={() => void submit()}
            >
              {formMode === 'sign-in' ? 'Sign in' : 'Create account'}
            </PrimaryButton>

            <View style={styles.accountSwitch}>
              <AppText color={palette.muted} variant="support">
                {formMode === 'sign-in' ? 'New here?' : 'Already registered?'}
              </AppText>
              <TextButton onPress={() => selectMode(formMode === 'sign-in' ? 'sign-up' : 'sign-in')}>
                {formMode === 'sign-in' ? 'Create account' : 'Sign in'}
              </TextButton>
            </View>

            {formMode === 'sign-in' ? (
              <TextButton
                icon={role === 'admin' ? UserRound : LockKeyhole}
                onPress={() => { setRole(role === 'admin' ? 'student' : 'admin'); setError(''); }}
                style={styles.roleSwitch}
              >
                {role === 'admin' ? 'Student sign in' : 'Admin access'}
              </TextButton>
            ) : null}
          </Surface>
        </View>
      </ContentShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  topbar: { minHeight: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  topbarAction: { alignSelf: 'center' },
  body: { flex: 1, minHeight: 620, justifyContent: 'center', paddingVertical: spacing.xl },
  formCard: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: spacing.lg },
  formHeading: { gap: spacing.sm },
  adminLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  setupNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.warningSoft,
  },
  fields: { gap: spacing.md },
  passwordToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.line,
    backgroundColor: palette.surfaceStrong,
  },
  checkboxChecked: { borderColor: palette.wine, backgroundColor: palette.wine },
  termsCopy: { flex: 1, alignItems: 'flex-start', gap: spacing.xxs },
  termsLink: { minHeight: 32, paddingHorizontal: 0, paddingVertical: 0 },
  legalLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  accountSwitch: {
    minHeight: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  roleSwitch: { alignSelf: 'center' },
});
