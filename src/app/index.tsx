import { router } from 'expo-router';
import {
  ArrowRight,
  Check,
  Clock3,
  EyeOff,
  LockKeyhole,
  Search,
  ShieldCheck,
} from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  BrandLockup,
  CategoryArt,
  ContentShell,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Surface,
} from '@/components/strathfind';
import { layout, palette, radius, spacing } from '@/constants/design';

const promises = [
  { icon: ShieldCheck, label: 'Campus verified' },
  { icon: EyeOff, label: 'Private by design' },
  { icon: Clock3, label: '24-hour handoff' },
];

const steps = [
  { number: '01', title: 'Post it', copy: 'A photo, a place, one private clue. Under a minute.' },
  { number: '02', title: 'Match it', copy: 'Campus-only search connects lost and found reports.' },
  { number: '03', title: 'Return it', copy: 'Verify ownership, meet safely, or hand it to the office.' },
];

export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ContentShell maxWidth={layout.marketingMax}>
        <View accessibilityLabel="Primary" role="navigation" style={styles.nav}>
          <BrandLockup markSize={42} />
          <View style={styles.navActions}>
            {wide ? (
              <AppText color={palette.muted} variant="support">Made for campus</AppText>
            ) : null}
            <SecondaryButton onPress={() => router.push('/auth')}>Sign in</SecondaryButton>
          </View>
        </View>

        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={styles.heroCopy}>
            <View style={styles.eyebrow}>
              <View style={styles.liveDot} />
              <AppText color={palette.wine} variant="micro">STRATHMORE CAMPUS</AppText>
            </View>
            <AppText
              accessibilityRole="header"
              style={[styles.heroTitle, !wide && styles.heroTitleMobile]}
              variant={wide ? 'display' : 'h1'}
            >
              Lost on campus.{`\n`}Found with care.
            </AppText>
            <AppText color={palette.inkSoft} style={styles.heroBody} variant="body">
              A private, student-first way to report, match and return what matters.
            </AppText>
            <View style={styles.heroActions}>
              <PrimaryButton icon={Search} iconPosition="right" onPress={() => router.push('/auth')}>
                Find an item
              </PrimaryButton>
              <SecondaryButton onPress={() => router.push('/auth')}>Report found</SecondaryButton>
            </View>
            <View style={styles.promiseRow}>
              {promises.map(({ icon: Icon, label }) => (
                <View key={label} style={styles.promise}>
                  <Icon color={palette.wine} size={17} strokeWidth={2.2} />
                  <AppText color={palette.inkSoft} variant="support">{label}</AppText>
                </View>
              ))}
            </View>
          </View>

          <Surface padding={wide ? 'lg' : 'md'} style={[styles.preview, wide && styles.previewWide]}>
            <View style={styles.previewTop}>
              <View>
                <AppText color={palette.muted} variant="micro">NEAR YOU</AppText>
                <AppText variant="h3">Found today</AppText>
              </View>
              <View style={styles.countBadge}>
                <AppText color={palette.white} variant="micro">12 LIVE</AppText>
              </View>
            </View>
            <Surface padding="sm" tone="strong" style={styles.previewItem}>
              <CategoryArt category="electronics" size={92} />
              <View style={styles.previewItemCopy}>
                <AppText color={palette.muted} variant="micro">ELECTRONICS</AppText>
                <AppText variant="h3">Black earbuds case</AppText>
                <AppText color={palette.inkSoft} variant="support">Main library · Level 2</AppText>
                <View style={styles.timeRow}>
                  <Clock3 color={palette.danger} size={16} />
                  <AppText color={palette.danger} variant="support">5h to office handoff</AppText>
                </View>
              </View>
            </Surface>
            <View style={styles.matchStrip}>
              <View style={styles.matchIcon}>
                <Check color={palette.black} size={18} strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Possible match found</AppText>
                <AppText color={palette.muted} variant="support">Private clues still protect ownership.</AppText>
              </View>
              <ArrowRight color={palette.wine} size={20} />
            </View>
          </Surface>
        </View>

        <View nativeID="how" style={styles.section}>
          <View style={styles.sectionIntro}>
            <AppText color={palette.wine} variant="micro">SIMPLE BY DESIGN</AppText>
            <AppText accessibilityRole="header" variant="h2">Three steps. No noise.</AppText>
          </View>
          <View style={[styles.stepGrid, wide && styles.stepGridWide]}>
            {steps.map((step) => (
              <Surface key={step.number} padding="lg" style={styles.stepCard}>
                <AppText color={palette.wine} variant="micro">{step.number}</AppText>
                <AppText variant="h3">{step.title}</AppText>
                <AppText color={palette.muted} variant="body">{step.copy}</AppText>
              </Surface>
            ))}
          </View>
        </View>

        <View style={[styles.safety, wide && styles.safetyWide]}>
          <View style={styles.safetyIcon}>
            <LockKeyhole color={palette.yellow} size={30} strokeWidth={2} />
          </View>
          <View style={styles.safetyCopy}>
            <AppText color={palette.white} variant="h2">Details stay private.</AppText>
            <AppText color="#F3DDE4" variant="body">
              Numbers stay masked until a verified student claims an item. Every reveal and handoff is logged.
            </AppText>
          </View>
          <PrimaryButton
            onPress={() => router.push('/auth')}
            style={styles.yellowButton}
            textStyle={{ color: palette.black }}
          >
            Join StrathFind
          </PrimaryButton>
        </View>

        <View style={styles.footer}>
          <BrandLockup markSize={36} />
          <AppText color={palette.muted} variant="support">StrathFind · Safer returns on campus</AppText>
        </View>
      </ContentShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  hero: { paddingTop: spacing.xl, paddingBottom: spacing.hero, gap: spacing.xl },
  heroWide: { minHeight: 650, flexDirection: 'row', alignItems: 'center', gap: spacing.section },
  heroCopy: { flex: 1, gap: spacing.lg },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveDot: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: palette.yellow, borderWidth: 2, borderColor: palette.black },
  heroTitle: { maxWidth: 660 },
  heroTitleMobile: { maxWidth: 480 },
  heroBody: { maxWidth: 530, fontSize: 18, lineHeight: 28 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  promiseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  promise: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  preview: { flex: 1, gap: spacing.md, minWidth: 0 },
  previewWide: { maxWidth: 520, transform: [{ rotate: '1.3deg' }] },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, backgroundColor: palette.wine },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewItemCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  matchStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.yellow },
  matchIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 2, borderColor: palette.black },
  section: { paddingBottom: spacing.hero, gap: spacing.xl },
  sectionIntro: { alignItems: 'center', gap: spacing.xs },
  stepGrid: { gap: spacing.md },
  stepGridWide: { flexDirection: 'row' },
  stepCard: { flex: 1, gap: spacing.sm, minHeight: 190 },
  safety: { gap: spacing.lg, padding: spacing.xl, marginBottom: spacing.section, borderRadius: radius.xl, backgroundColor: palette.wine },
  safetyWide: { flexDirection: 'row', alignItems: 'center', padding: spacing.xxl },
  safetyIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.black },
  safetyCopy: { flex: 1, maxWidth: layout.readingMax, gap: spacing.xs },
  yellowButton: { backgroundColor: palette.yellow, borderColor: palette.black, borderWidth: 1 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: palette.lineSoft },
});
