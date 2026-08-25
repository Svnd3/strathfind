import { Redirect, router } from 'expo-router';
import {
  Archive,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Flag,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ScanLine,
  ShieldCheck,
  UsersRound,
} from 'lucide-react-native';
import { useMemo, useState, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import {
  AppText,
  BrandLockup,
  Chip,
  ContentShell,
  EmptyState,
  IconButton,
  ItemCard,
  PrimaryButton,
  RouteLoadingScreen,
  Screen,
  SecondaryButton,
  SectionHeading,
  StatusPill,
  Surface,
  TextArea,
  TextButton,
  TextField,
} from '@/components/strathfind';
import { palette, radius, spacing } from '@/constants/design';
import { handoffLabel } from '@/lib/item-utils';
import type { ItemStatus } from '@/lib/types';
import { useAppState } from '@/state';

type AdminView = 'overview' | 'intake' | 'claims' | 'moderation' | 'codes' | 'audit';

const navItems: { value: AdminView; label: string; icon: ComponentType<LucideProps> }[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'intake', label: 'Intake', icon: Boxes },
  { value: 'claims', label: 'Claims', icon: ClipboardCheck },
  { value: 'moderation', label: 'Moderation', icon: Flag },
  { value: 'codes', label: 'Access codes', icon: UsersRound },
  { value: 'audit', label: 'Audit', icon: ShieldCheck },
];

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const {
    activity,
    claims,
    createUniversityCode,
    flags,
    items,
    loading,
    mode,
    recordCustodyHandoff,
    reviewClaim,
    reviewFlag,
    role,
    signOut,
    updateItemStatus,
    user,
  } = useAppState();
  const [view, setView] = useState<AdminView>('overview');
  const [generatedCode, setGeneratedCode] = useState(
    mode === 'setup' ? 'Connect Supabase first' : 'Create a code',
  );

  const issueUniversityCode = async () => {
    const result = await createUniversityCode();
    if (result.ok) setGeneratedCode(result.data);
  };

  const metrics = useMemo(() => ({
    open: items.filter((item) => item.status !== 'returned').length,
    due: items.filter((item) => item.status === 'handoff_due').length,
    claims: claims.filter((claim) => claim.status === 'pending').length,
    office: items.filter((item) => item.status === 'at_office').length,
    flags: flags.filter((flag) => flag.status === 'open').length,
  }), [claims, flags, items]);

  const intake = items
    .filter((item) => item.kind === 'found' && item.status !== 'returned')
    .sort((left, right) => {
      if (left.status === 'at_office') return 1;
      if (right.status === 'at_office') return -1;
      return new Date(left.handoffDueAt ?? 0).getTime() - new Date(right.handoffDueAt ?? 0).getTime();
    });

  if (loading) return <RouteLoadingScreen />;
  if (role === 'student') return <Redirect href="/lost" />;
  if (!role) return <Redirect href="/auth" />;

  const leave = async () => {
    await signOut();
    router.replace('/');
  };

  const changeStatus = async (id: string, status: ItemStatus) => {
    await updateItemStatus(id, status);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ContentShell maxWidth={1380} style={[styles.shell, wide && styles.shellWide]}>
        {wide ? (
          <View accessibilityLabel="Admin" role="navigation" style={styles.sidebar}>
            <BrandLockup inverse markSize={42} />
            <View style={styles.adminIdentity}>
              <View style={styles.adminAvatar}><ShieldCheck color={palette.yellow} size={24} /></View>
              <View style={{ flex: 1 }}>
                <AppText color={palette.white} variant="bodyStrong">{user?.name ?? 'Campus Services'}</AppText>
                <AppText color="#E6C9D2" variant="support">Administrator</AppText>
              </View>
            </View>
            <View style={styles.sidebarNav}>
              {navItems.map((item) => (
                <AdminNavButton
                  icon={item.icon}
                  key={item.value}
                  label={item.label}
                  onPress={() => setView(item.value)}
                  selected={view === item.value}
                />
              ))}
            </View>
            <AdminNavButton icon={LogOut} label="Sign out" onPress={() => void leave()} />
          </View>
        ) : null}

        <View style={styles.main}>
          <View style={styles.adminTopbar}>
            {!wide ? <BrandLockup markSize={38} /> : <View />}
            <View style={styles.topbarActions}>
              <View style={styles.liveStatus}>
                <View style={styles.liveDot} />
                <AppText color={palette.success} variant="support">
                  {mode === 'setup' ? 'Setup needed' : 'Operations live'}
                </AppText>
              </View>
              {!wide ? <IconButton accessibilityLabel="Sign out" icon={LogOut} onPress={() => void leave()} /> : null}
            </View>
          </View>

          {!wide ? (
            <View style={styles.mobileNav}>
              {navItems.map((item) => (
                <Chip key={item.value} label={item.label} onPress={() => setView(item.value)} selected={view === item.value} />
              ))}
            </View>
          ) : null}

          {view === 'overview' ? (
            <Overview
              intake={intake}
              metrics={metrics}
              onReviewIntake={() => setView('intake')}
              onOpen={(id) => router.push({ pathname: '/item/[id]', params: { id } })}
            />
          ) : null}
          {view === 'intake' ? (
            <Intake
              claims={claims}
              items={intake}
              onHandoff={(id, code) => recordCustodyHandoff(id, undefined, code)}
              onOpen={(id) => router.push({ pathname: '/item/[id]', params: { id } })}
              onReturn={(id) => void changeStatus(id, 'returned')}
            />
          ) : null}
          {view === 'claims' ? <Claims claims={claims} items={items} onReview={reviewClaim} /> : null}
          {view === 'moderation' ? (
            <Moderation
              flags={flags}
              items={items}
              onOpen={(id) => router.push({ pathname: '/item/[id]', params: { id } })}
              onReview={reviewFlag}
            />
          ) : null}
          {view === 'codes' ? (
            <Codes generatedCode={generatedCode} onGenerate={issueUniversityCode} />
          ) : null}
          {view === 'audit' ? <Audit entries={activity} /> : null}
        </View>
      </ContentShell>
    </Screen>
  );
}

function Overview({
  intake,
  metrics,
  onReviewIntake,
  onOpen,
}: {
  intake: ReturnType<typeof useAppState>['items'];
  metrics: { open: number; due: number; claims: number; office: number; flags: number };
  onReviewIntake: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.view}>
      <SectionHeading title="Overview" level={1} />
      <View style={styles.metrics}>
        <Metric icon={Archive} label="Open reports" value={metrics.open} />
        <Metric icon={Clock3} label="Handoff due" value={metrics.due} urgent={metrics.due > 0} />
        <Metric icon={ClipboardCheck} label="Pending claims" value={metrics.claims} />
        <Metric icon={Boxes} label="At office" value={metrics.office} />
        <Metric icon={Flag} label="Open flags" value={metrics.flags} urgent={metrics.flags > 0} />
      </View>
      <Surface padding="lg" tone="strong" style={styles.queue}>
        <SectionHeading title="Handoff queue" level={3} />
        {intake.length ? intake.slice(0, 3).map((item) => (
          <View key={item.id} style={styles.queueRow}>
            <View style={styles.queueIcon}><Clock3 color={item.status === 'handoff_due' ? palette.danger : palette.wine} size={22} /></View>
            <View style={styles.queueCopy}>
              <AppText variant="bodyStrong">{item.title}</AppText>
              <AppText color={palette.muted} variant="support">{item.location} · {handoffLabel(item)}</AppText>
            </View>
            {item.status !== 'at_office' ? (
              <PrimaryButton icon={ScanLine} onPress={onReviewIntake}>Review intake</PrimaryButton>
            ) : (
              <TextButton onPress={() => onOpen(item.id)}>View</TextButton>
            )}
          </View>
        )) : <EmptyState title="Queue clear" />}
      </Surface>
    </View>
  );
}

function Intake({
  claims,
  items,
  onHandoff,
  onOpen,
  onReturn,
}: {
  claims: ReturnType<typeof useAppState>['claims'];
  items: ReturnType<typeof useAppState>['items'];
  onHandoff: (id: string, code: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
  onOpen: (id: string) => void;
  onReturn: (id: string) => void;
}) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const confirm = async (itemId: string) => {
    const result = await onHandoff(itemId, codes[itemId] ?? '');
    setErrors((current) => ({ ...current, [itemId]: result.ok ? '' : result.error }));
  };

  return (
    <View style={styles.view}>
      <SectionHeading title="Intake & inventory" level={1} />
      {items.length ? items.map((item) => (
        <Surface key={item.id} padding="md" tone="strong" style={styles.intakeRow}>
          <View style={styles.intakeCard}><ItemCard compact item={item} onPress={() => onOpen(item.id)} /></View>
          <View style={styles.intakeActions}>
            {item.status !== 'at_office' ? (
              <>
                <TextField
                  error={errors[item.id]}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  label="6-digit handoff code"
                  maxLength={6}
                  onChangeText={(value) => {
                    setCodes((current) => ({ ...current, [item.id]: value.replace(/\D/g, '') }));
                    setErrors((current) => ({ ...current, [item.id]: '' }));
                  }}
                  placeholder="000000"
                  value={codes[item.id] ?? ''}
                />
                <PrimaryButton
                  disabled={(codes[item.id]?.length ?? 0) !== 6}
                  icon={ScanLine}
                  onPress={() => void confirm(item.id)}
                >
                  Verify & receive
                </PrimaryButton>
              </>
            ) : claims.some((claim) => claim.itemId === item.id && claim.status === 'accepted') ? (
              <PrimaryButton icon={CheckCircle2} onPress={() => onReturn(item.id)}>Mark returned</PrimaryButton>
            ) : (
              <AppText color={palette.muted} variant="support">Awaiting an approved ownership claim.</AppText>
            )}
            <SecondaryButton onPress={() => onOpen(item.id)}>Details</SecondaryButton>
          </View>
        </Surface>
      )) : <EmptyState title="No inventory" />}
    </View>
  );
}

function Claims({
  claims,
  items,
  onReview,
}: {
  claims: ReturnType<typeof useAppState>['claims'];
  items: ReturnType<typeof useAppState>['items'];
  onReview: ReturnType<typeof useAppState>['reviewClaim'];
}) {
  return (
    <View style={styles.view}>
      <SectionHeading title="Claims" level={1} />
      {claims.length ? claims.map((claim) => {
        const item = items.find((candidate) => candidate.id === claim.itemId);
        return (
          <Surface key={claim.id} padding="lg" style={styles.claimRow}>
            <View style={styles.claimIcon}><ClipboardCheck color={palette.wine} size={24} /></View>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <AppText variant="bodyStrong">{item?.title ?? 'Item claim'}</AppText>
              <AppText color={palette.inkSoft} variant="support">Claimant: {claim.claimantName ?? 'Verified student'}</AppText>
              <AppText color={palette.muted} variant="support">Private answer: {claim.note}</AppText>
              <AppText color={palette.muted} variant="micro">{new Date(claim.createdAt).toLocaleString()}</AppText>
            </View>
            <View style={styles.claimActions}>
              <StatusPill label={claim.status} tone={claim.status === 'pending' ? 'warning' : claim.status === 'accepted' ? 'success' : 'danger'} />
              {claim.status === 'pending' ? (
                <View style={styles.claimButtons}>
                  <SecondaryButton onPress={() => void onReview(claim.id, false)}>Decline</SecondaryButton>
                  <PrimaryButton onPress={() => void onReview(claim.id, true)}>Approve</PrimaryButton>
                </View>
              ) : null}
            </View>
          </Surface>
        );
      }) : <EmptyState title="No pending claims" />}
    </View>
  );
}

function Codes({ generatedCode, onGenerate }: { generatedCode: string; onGenerate: () => Promise<void> }) {
  return (
    <View style={styles.view}>
      <SectionHeading title="Access codes" level={1} />
      <Surface padding="xl" style={styles.codeCard}>
        <View style={styles.codeIcon}><KeyRound color={palette.yellow} size={30} /></View>
        <AppText color={palette.muted} variant="micro">LATEST UNIVERSITY CODE</AppText>
        <AppText selectable style={styles.codeText} variant="h1">{generatedCode}</AppText>
        <AppText align="center" color={palette.muted} variant="support">Expires in seven days.</AppText>
        <PrimaryButton onPress={() => void onGenerate()}>Create new code</PrimaryButton>
      </Surface>
      <Surface padding="lg" tone="inset" style={styles.policyRow}>
        <ShieldCheck color={palette.wine} size={24} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">No public admin signup</AppText>
          <AppText color={palette.muted} variant="support">Provisioned by a trusted admin.</AppText>
        </View>
      </Surface>
    </View>
  );
}

function Moderation({
  flags,
  items,
  onOpen,
  onReview,
}: {
  flags: ReturnType<typeof useAppState>['flags'];
  items: ReturnType<typeof useAppState>['items'];
  onOpen: (itemId: string) => void;
  onReview: ReturnType<typeof useAppState>['reviewFlag'];
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string>();
  const sorted = [...flags].sort((left, right) => {
    if (left.status === 'open' && right.status !== 'open') return -1;
    if (right.status === 'open' && left.status !== 'open') return 1;
    return right.createdAt.localeCompare(left.createdAt);
  });

  const resolve = async (flagId: string, status: 'dismissed' | 'actioned') => {
    setErrors((current) => ({ ...current, [flagId]: '' }));
    setBusyId(flagId);
    try {
      const result = await onReview(flagId, status, notes[flagId] ?? '');
      if (!result.ok) {
        setErrors((current) => ({ ...current, [flagId]: result.error }));
        return;
      }
      setNotes((current) => ({ ...current, [flagId]: '' }));
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <View style={styles.view}>
      <SectionHeading level={1} title="Moderation" />
      {sorted.length ? sorted.map((flag) => {
        const item = items.find((candidate) => candidate.id === flag.itemId);
        const note = notes[flag.id] ?? '';
        return (
          <Surface key={flag.id} padding="lg" style={styles.flagCard}>
            <View style={styles.flagHeading}>
              <View style={styles.claimIcon}><Flag color={palette.wine} size={23} /></View>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <AppText color={palette.wine} variant="micro">{flag.reason.toUpperCase()}</AppText>
                <AppText variant="h3">{item?.title ?? 'Campus report'}</AppText>
                <AppText color={palette.muted} variant="micro">{new Date(flag.createdAt).toLocaleString()}</AppText>
              </View>
              <StatusPill
                label={flag.status}
                tone={flag.status === 'open' ? 'warning' : flag.status === 'actioned' ? 'success' : 'neutral'}
              />
            </View>
            <Surface padding="md" tone="inset">
              <AppText color={palette.muted} variant="micro">STUDENT REPORT</AppText>
              <AppText variant="support">{flag.details}</AppText>
            </Surface>
            {flag.status === 'open' ? (
              <>
                <TextArea
                  error={errors[flag.id]}
                  label="Resolution note"
                  maxLength={500}
                  onChangeText={(value) => setNotes((current) => ({ ...current, [flag.id]: value }))}
                  placeholder="Record what was checked or changed."
                  value={note}
                />
                <View style={styles.flagActions}>
                  <SecondaryButton onPress={() => onOpen(flag.itemId)}>Open report</SecondaryButton>
                  <SecondaryButton
                    disabled={note.trim().length < 3 || busyId === flag.id}
                    onPress={() => void resolve(flag.id, 'dismissed')}
                  >
                    Dismiss
                  </SecondaryButton>
                  <PrimaryButton
                    disabled={note.trim().length < 3}
                    loading={busyId === flag.id}
                    onPress={() => void resolve(flag.id, 'actioned')}
                  >
                    Resolve
                  </PrimaryButton>
                </View>
              </>
            ) : (
              <View style={styles.resolutionRow}>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText color={palette.muted} variant="micro">RESOLUTION</AppText>
                  <AppText variant="support">{flag.resolutionNote ?? 'Reviewed by campus staff.'}</AppText>
                </View>
                <TextButton onPress={() => onOpen(flag.itemId)}>Open report</TextButton>
              </View>
            )}
          </Surface>
        );
      }) : <EmptyState title="No moderation reports" />}
    </View>
  );
}

function Audit({ entries }: { entries: ReturnType<typeof useAppState>['activity'] }) {
  return (
    <View style={styles.view}>
      <SectionHeading title="Audit trail" level={1} />
      <Surface padding={0} tone="strong">
        {entries.map((entry, index) => (
          <View key={entry.id} style={[styles.auditRow, index > 0 && styles.auditBorder]}>
            <View style={styles.auditDot} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{entry.title}</AppText>
              <AppText color={palette.muted} variant="support">{entry.message}</AppText>
            </View>
            <AppText color={palette.muted} variant="micro">{new Date(entry.createdAt).toLocaleDateString()}</AppText>
          </View>
        ))}
      </Surface>
    </View>
  );
}

function Metric({ icon: Icon, label, value, urgent = false }: { icon: ComponentType<LucideProps>; label: string; value: number; urgent?: boolean }) {
  return (
    <Surface padding="lg" style={styles.metric}>
      <View style={[styles.metricIcon, urgent && styles.metricUrgent]}><Icon color={urgent ? palette.danger : palette.wine} size={22} /></View>
      <AppText color={urgent ? palette.danger : palette.ink} variant="h1">{value}</AppText>
      <AppText color={palette.muted} variant="support">{label}</AppText>
    </Surface>
  );
}

function AdminNavButton({ icon: Icon, label, onPress, selected = false }: { icon: ComponentType<LucideProps>; label: string; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.navButton, selected && styles.navButtonSelected, pressed && { opacity: 0.8 }]}
    >
      <Icon color={selected ? palette.black : palette.white} size={20} />
      <AppText color={selected ? palette.black : palette.white} variant="bodyStrong">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, gap: spacing.lg },
  shellWide: { flexDirection: 'row', alignItems: 'stretch', paddingTop: spacing.lg },
  sidebar: { width: 260, minHeight: Platform.OS === 'web' ? 760 : undefined, gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: palette.wine },
  adminIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#9A3A56' },
  adminAvatar: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.black },
  sidebarNav: { flex: 1, gap: spacing.xs },
  navButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  navButtonSelected: { backgroundColor: palette.yellow },
  main: { flex: 1, minWidth: 0, gap: spacing.lg, paddingBottom: spacing.xxl },
  adminTopbar: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, minHeight: 40, borderRadius: radius.pill, backgroundColor: palette.successSoft },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.success },
  mobileNav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  view: { gap: spacing.xl },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { minWidth: 180, flex: 1, gap: spacing.xs },
  metricIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.wineSoft },
  metricUrgent: { backgroundColor: palette.dangerSoft },
  queue: { gap: spacing.lg },
  queueRow: { minHeight: 74, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: palette.lineSoft },
  queueIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.inset },
  queueCopy: { flex: 1, minWidth: 180 },
  intakeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  intakeCard: { flex: 1, minWidth: 0 },
  intakeActions: { width: '100%', maxWidth: 280, gap: spacing.xs },
  claimRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  claimIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.wineSoft },
  claimActions: { alignItems: 'flex-end', gap: spacing.sm },
  claimButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs },
  flagCard: { gap: spacing.md },
  flagHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  flagActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs },
  resolutionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  codeCard: { alignItems: 'center', gap: spacing.md },
  codeIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: palette.black },
  codeText: { color: palette.wine, letterSpacing: 2 },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  auditRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  auditBorder: { borderTopWidth: 1, borderTopColor: palette.lineSoft },
  auditDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.wine },
});
