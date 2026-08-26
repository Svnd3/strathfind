import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
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
import { focusRing, radius, spacing, type AppPalette } from '@/constants/design';
import type { UserRole } from '@/lib/types';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

type FormMode = 'sign-in' | 'sign-up';

interface PortalOptionProps {
  colors: AppPalette;
  icon: typeof UserRound;
  label: string;
  onPress: () => void;
  selected: boolean;
  styles: ReturnType<typeof createStyles>;
}

function PortalOption({ colors, icon: Icon, label, onPress, selected, styles }: PortalOptionProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityHint={`Use the ${label.toLowerCase()} portal`}
      accessibilityLabel={`${label} sign in`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.portalOption,
        selected && styles.portalOptionSelected,
        pressed && styles.portalOptionPressed,
        focusRing(focused, colors.wine),
      ]}
    >
      <Icon color={selected ? colors.wine : colors.inkSoft} size={20} strokeWidth={2.2} />
      <AppText color={selected ? colors.ink : colors.inkSoft} variant="bodyStrong">
        {label}
      </AppText>
      {selected ? <Check color={colors.wine} size={18} strokeWidth={3} /> : null}
    </Pressable>
  );
}

function safeReturnTo(value: string | undefined): Href | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value === '/auth' || value.startsWith('/auth?')) return null;
  return value as Href;
}

export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const { loading, mode: dataMode, signIn, signUp } = useAppState();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [formMode, setFormMode] = useState<FormMode>(params.mode === 'sign-up' ? 'sign-up' : 'sign-in');
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [campusId, setCampusId] = useState('');
  const [universityCode, setUniversityCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordToggleFocused, setPasswordToggleFocused] = useState(false);
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
      const result = await signIn({ email, password, portal: role });
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
    ? 'Create student account'
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
              {formMode === 'sign-up' ? (
                <View style={styles.adminLabel}>
                  <UserRound color={colors.wine} size={17} />
                  <AppText color={colors.inkSoft} variant="support">Student accounts only</AppText>
                </View>
              ) : role === 'admin' ? (
                <View style={styles.adminLabel}>
                  <LockKeyhole color={colors.wine} size={17} />
                  <AppText color={colors.inkSoft} variant="support">Provisioned by authorised admins</AppText>
                </View>
              ) : null}
            </View>

            {formMode === 'sign-in' ? (
              <View
                accessibilityLabel="Choose sign-in portal"
                accessibilityRole="radiogroup"
                style={styles.portalGroup}
              >
                <PortalOption
                  colors={colors}
                  icon={UserRound}
                  label="Student"
                  onPress={() => { setRole('student'); setError(''); }}
                  selected={role === 'student'}
                  styles={styles}
                />
                <PortalOption
                  colors={colors}
                  icon={ShieldCheck}
                  label="Admin"
                  onPress={() => { setRole('admin'); setError(''); }}
                  selected={role === 'admin'}
                  styles={styles}
                />
              </View>
            ) : null}

            {dataMode === 'setup' ? (
              <View style={styles.setupNotice}>
                <ShieldCheck color={colors.warning} size={20} />
                <AppText color={colors.warning} style={{ flex: 1 }} variant="support">
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
                    onBlur={() => setPasswordToggleFocused(false)}
                    onFocus={() => setPasswordToggleFocused(true)}
                    onPress={() => setShowPassword((current) => !current)}
                    style={[styles.passwordToggle, focusRing(passwordToggleFocused, colors.wine)]}
                  >
                    {showPassword
                      ? <EyeOff color={colors.muted} size={20} />
                      : <Eye color={colors.muted} size={20} />}
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
                  style={[styles.checkbox, acceptedTerms && styles.checkboxChecked, focusRing(termsFocused, colors.wine)]}
                >
                  {acceptedTerms ? <Check color={colors.onPrimary} size={18} strokeWidth={3} /> : null}
                </Pressable>
                <View style={styles.termsCopy}>
                  <AppText color={colors.inkSoft} variant="support">
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
              <AppText accessibilityLiveRegion="polite" color={colors.danger} variant="support">{error}</AppText>
            ) : null}

            <PrimaryButton
              disabled={dataMode === 'setup' || (formMode === 'sign-up' && !acceptedTerms)}
              fullWidth
              loading={loading}
              onPress={() => void submit()}
            >
              {formMode === 'sign-in' ? `Sign in as ${role}` : 'Create student account'}
            </PrimaryButton>

            <View style={styles.accountSwitch}>
              <AppText color={colors.muted} variant="support">
                {formMode === 'sign-in' ? 'New here?' : 'Already registered?'}
              </AppText>
              <TextButton onPress={() => selectMode(formMode === 'sign-in' ? 'sign-up' : 'sign-in')}>
                {formMode === 'sign-in' ? 'Create account' : 'Sign in'}
              </TextButton>
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
    topbar: { minHeight: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    topbarAction: { alignSelf: 'center' },
    body: { flex: 1, minHeight: 620, justifyContent: 'center', paddingVertical: spacing.xl },
    formCard: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: spacing.lg },
    formHeading: { gap: spacing.sm },
    adminLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    portalGroup: { flexDirection: 'row', gap: spacing.sm },
    portalOption: {
      minHeight: 56,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.line,
      backgroundColor: colors.surfaceStrong,
    },
    portalOptionSelected: {
      borderColor: colors.wine,
      backgroundColor: colors.wineSoft,
    },
    portalOptionPressed: { opacity: 0.82 },
    setupNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.warningSoft,
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
      borderColor: colors.line,
      backgroundColor: colors.surfaceStrong,
    },
    checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
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
  });
}
