import { router } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  BrandLockup,
  ContentShell,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SegmentedControl,
  Surface,
  TextButton,
  TextField,
} from '@/components/strathfind';
import { layout, palette, radius, spacing } from '@/constants/design';
import type { UserRole } from '@/lib/types';
import { DEMO_UNIVERSITY_CODE, useAppState } from '@/state';

type FormMode = 'sign-in' | 'sign-up';

export default function AuthScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { loading, mode: dataMode, signIn, signUp } = useAppState();
  const [formMode, setFormMode] = useState<FormMode>('sign-in');
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [campusId, setCampusId] = useState('');
  const [universityCode, setUniversityCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const navigateForRole = (nextRole: UserRole) => {
    router.replace(nextRole === 'admin' ? '/admin' : '/(student)/find');
  };

  const submit = async () => {
    setError('');
    if (formMode === 'sign-in') {
      const result = await signIn({ email, password, role });
      if (!result.ok) return setError(result.error);
      navigateForRole(result.data.role);
      return;
    }

    const result = await signUp({ name, email, phone, campusId, universityCode, password });
    if (!result.ok) return setError(result.error);
    if (result.data) navigateForRole('student');
  };

  const enterDemo = async (demoRole: UserRole) => {
    setError('');
    setRole(demoRole);
    const result = await signIn({
      email: demoRole === 'admin' ? 'admin@strathfind.app' : 'student@strathfind.app',
      password: 'strathfind-demo',
      role: demoRole,
    });
    if (!result.ok) return setError(result.error);
    navigateForRole(demoRole);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ContentShell maxWidth={layout.marketingMax} style={styles.shell}>
        <View style={styles.topbar}>
          <TextButton icon={ArrowLeft} onPress={() => router.back()}>Back</TextButton>
          <BrandLockup markSize={40} />
        </View>

        <View style={[styles.body, wide && styles.bodyWide]}>
          {wide ? (
            <View style={styles.story}>
              <View style={styles.storyEyebrow}>
                <ShieldCheck color={palette.yellow} size={20} />
                <AppText color={palette.yellow} variant="micro">VERIFIED CAMPUS ACCESS</AppText>
              </View>
              <AppText color={palette.white} variant="display">Your campus.{`\n`}Your circle.</AppText>
              <AppText color="#F2DCE3" style={styles.storyBody} variant="body">
                Every report stays inside your university community. Contact details appear only after a verified claim.
              </AppText>
              <View style={styles.storyPoints}>
                {['University code required', 'Private proof protects claims', 'Every contact reveal is logged'].map((item) => (
                  <View key={item} style={styles.storyPoint}>
                    <View style={styles.checkCircle}><ShieldCheck color={palette.yellow} size={16} /></View>
                    <AppText color={palette.white} variant="support">{item}</AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Surface padding={wide ? 'xl' : 'lg'} style={styles.formCard}>
            <View style={styles.formHeading}>
              <AppText color={palette.wine} variant="micro">
                {formMode === 'sign-in' ? 'WELCOME BACK' : 'STUDENT ACCESS'}
              </AppText>
              <AppText accessibilityRole="header" variant="h1">
                {formMode === 'sign-in' ? 'Sign in' : 'Create account'}
              </AppText>
              <AppText color={palette.muted} variant="body">
                {formMode === 'sign-in'
                  ? 'Continue to your campus lost and found.'
                  : 'Verify your university before joining.'}
              </AppText>
            </View>

            <View style={styles.modeSwitch}>
              <SecondaryButton
                accessibilityState={{ selected: formMode === 'sign-in' }}
                onPress={() => { setFormMode('sign-in'); setError(''); }}
                style={formMode === 'sign-in' ? styles.modeActive : styles.modeButton}
              >
                Sign in
              </SecondaryButton>
              <SecondaryButton
                accessibilityState={{ selected: formMode === 'sign-up' }}
                onPress={() => { setFormMode('sign-up'); setRole('student'); setError(''); }}
                style={formMode === 'sign-up' ? styles.modeActive : styles.modeButton}
              >
                Create account
              </SecondaryButton>
            </View>

            {formMode === 'sign-in' ? (
              <SegmentedControl
                label="Account type"
                value={role}
                options={[{ label: 'Student', value: 'student' }, { label: 'Admin', value: 'admin' }]}
                onChange={setRole}
              />
            ) : null}

            <View style={styles.fields}>
              {formMode === 'sign-up' ? (
                <>
                  <TextField
                    autoComplete="name"
                    label="Full name"
                    onChangeText={setName}
                    placeholder="Your name"
                    value={name}
                  />
                  <TextField
                    autoCapitalize="characters"
                    label="University code"
                    onChangeText={setUniversityCode}
                    placeholder="Provided by your university"
                    value={universityCode}
                    helpText={dataMode === 'demo' ? `Preview code: ${DEMO_UNIVERSITY_CODE}` : 'Codes expire and allow a limited number of signups.'}
                  />
                  <TextField
                    autoCapitalize="characters"
                    label="Student number"
                    onChangeText={setCampusId}
                    placeholder="Your campus ID"
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
                placeholder="name@university.ac.ke"
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
                  helpText="Hidden until you approve contact after a claim."
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
                    hitSlop={10}
                    onPress={() => setShowPassword((current) => !current)}
                  >
                    {showPassword
                      ? <EyeOff color={palette.muted} size={20} />
                      : <Eye color={palette.muted} size={20} />}
                  </Pressable>
                )}
              />
            </View>

            {role === 'admin' && formMode === 'sign-in' ? (
              <View style={styles.adminNote}>
                <LockKeyhole color={palette.wine} size={20} />
                <AppText color={palette.inkSoft} style={{ flex: 1 }} variant="support">
                  Admin accounts are issued by campus services. Public admin signup is disabled.
                </AppText>
              </View>
            ) : null}

            {error ? <AppText accessibilityLiveRegion="polite" color={palette.danger} variant="support">{error}</AppText> : null}

            <PrimaryButton fullWidth loading={loading} onPress={() => void submit()}>
              {formMode === 'sign-in' ? `Continue as ${role}` : 'Verify and create account'}
            </PrimaryButton>

            {dataMode === 'demo' && formMode === 'sign-in' ? (
              <View style={styles.demoBox}>
                <AppText color={palette.muted} variant="micro">INTERACTIVE PREVIEW</AppText>
                <AppText color={palette.inkSoft} variant="support">
                  Enter any email and password, or jump straight in.
                </AppText>
                <View style={styles.demoActions}>
                  <TextButton icon={UserRound} onPress={() => void enterDemo('student')}>Student demo</TextButton>
                  <TextButton icon={LockKeyhole} onPress={() => void enterDemo('admin')}>Admin demo</TextButton>
                </View>
              </View>
            ) : null}

            <AppText align="center" color={palette.muted} variant="support">
              By continuing, you agree to safe returns and respectful contact.
            </AppText>
          </Surface>
        </View>
      </ContentShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  topbar: { minHeight: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  body: { flex: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  bodyWide: { minHeight: 720, flexDirection: 'row', alignItems: 'stretch', paddingVertical: spacing.xl },
  story: { flex: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl, borderTopLeftRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: palette.wine },
  storyEyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  storyBody: { maxWidth: 520, fontSize: 18, lineHeight: 28 },
  storyPoints: { gap: spacing.md, marginTop: spacing.md },
  storyPoint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkCircle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.black },
  formCard: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', justifyContent: 'center', gap: spacing.lg },
  formHeading: { gap: spacing.xs },
  modeSwitch: { flexDirection: 'row', gap: spacing.xs },
  modeButton: { flex: 1, borderColor: palette.lineSoft, backgroundColor: palette.surfaceStrong },
  modeActive: { flex: 1, borderColor: palette.wine, backgroundColor: palette.wineSoft },
  fields: { gap: spacing.md },
  adminNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.wineSoft },
  demoBox: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.inset },
  demoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
