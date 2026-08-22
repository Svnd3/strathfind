import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  Flag,
  KeyRound,
  LockKeyhole,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  CategoryArt,
  ContentShell,
  EmptyState,
  PrimaryButton,
  RouteLoadingScreen,
  Screen,
  SecondaryButton,
  StatusPill,
  Surface,
  TextArea,
  TextButton,
  getCategoryLabel,
} from '@/components/strathfind';
import { palette, radius, spacing } from '@/constants/design';
import { handoffLabel } from '@/lib/item-utils';
import { useAppState } from '@/state';

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string; created?: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    claims,
    claimItem,
    flagItem,
    flaggedItemIds,
    getHandoffCode,
    getItem,
    loading,
    revealContact,
    revealedContactIds,
    reviewClaim,
    role,
    updateItemStatus,
    user,
  } = useAppState();
  const item = getItem(itemId);
  const [showClaim, setShowClaim] = useState(false);
  const [proof, setProof] = useState('');
  const [contact, setContact] = useState<string>();
  const [showFlag, setShowFlag] = useState(false);
  const [flagDetails, setFlagDetails] = useState('');
  const [issuedHandoff, setIssuedHandoff] = useState<{ itemId: string; code: string }>();
  const [handoffCodeLoading, setHandoffCodeLoading] = useState(false);
  const [returnConfirm, setReturnConfirm] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [error, setError] = useState('');
  const myClaim = useMemo(
    () => claims.find((claim) => claim.itemId === itemId && claim.claimantId === user?.id),
    [claims, itemId, user?.id],
  );
  const managedClaims = useMemo(
    () => claims.filter((claim) => claim.itemId === itemId && claim.claimantId !== user?.id),
    [claims, itemId, user?.id],
  );

  if (loading) return <RouteLoadingScreen />;
  if (!role) return <Redirect href="/auth" />;

  if (!item) {
    return (
      <Screen>
        <ContentShell style={styles.shell}>
          <TextButton icon={ArrowLeft} onPress={() => router.back()}>Back</TextButton>
          <EmptyState
            actionLabel="Browse reports"
            message="It may have been returned, archived, or removed."
            onAction={() => router.replace('/(student)/find')}
            title="Report not found"
          />
        </ContentShell>
      </Screen>
    );
  }

  const ownsReport = item.ownerId === user?.id || item.finderId === user?.id;
  const isAdmin = user?.role === 'admin';
  const claimAccepted = myClaim?.status === 'accepted';
  const acceptedManagedClaim = managedClaims.find((claim) => claim.status === 'accepted');
  const handoffCode = issuedHandoff?.itemId === item.id ? issuedHandoff.code : undefined;
  const canIssueHandoffCode = item.kind === 'found'
    && item.finderId === user?.id
    && ['published', 'claim_pending', 'pickup_agreed', 'handoff_due'].includes(item.status);
  const claimLabel = item.kind === 'found' ? 'This is mine' : 'I found this';
  const canConfirmDirectReturn = Boolean(
    ownsReport
      && acceptedManagedClaim
      && item.status !== 'at_office'
      && item.status !== 'returned',
  );

  const submitClaim = async () => {
    setError('');
    const result = await claimItem(item.id, proof);
    if (!result.ok) return setError(result.error);
    setShowClaim(false);
  };

  const showContact = async () => {
    setError('');
    const result = await revealContact(item.id);
    if (!result.ok) return setError(result.error);
    setContact(result.data);
  };

  const reportListing = async () => {
    setError('');
    if (flagDetails.trim().length < 10) {
      setError('Tell campus staff what needs review in at least 10 characters.');
      return;
    }
    const result = await flagItem(item.id, flagDetails);
    if (!result.ok) return setError(result.error);
    setShowFlag(false);
    setFlagDetails('');
  };

  const createHandoffCode = async () => {
    setError('');
    setHandoffCodeLoading(true);
    try {
      const result = await getHandoffCode(item.id);
      if (!result.ok) return setError(result.error);
      setIssuedHandoff({ itemId: item.id, code: result.data });
    } finally {
      setHandoffCodeLoading(false);
    }
  };

  const confirmReturn = async () => {
    setError('');
    setReturnLoading(true);
    try {
      const result = await updateItemStatus(item.id, 'returned');
      if (!result.ok) return setError(result.error);
      setReturnConfirm(false);
    } finally {
      setReturnLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ContentShell maxWidth={1040} style={styles.shell}>
        <View style={styles.topbar}>
          <TextButton icon={ArrowLeft} onPress={() => router.back()}>Back</TextButton>
          <StatusPill status={item.status} />
        </View>

        {params.created === '1' ? (
          <Surface padding="md" tone="inset" style={styles.createdBanner}>
            <CheckCircle2 color={palette.success} size={22} />
            <View style={{ flex: 1 }}>
              <AppText color={palette.success} variant="bodyStrong">Report published</AppText>
              <AppText color={palette.inkSoft} variant="support">We are checking for possible campus matches.</AppText>
            </View>
          </Surface>
        ) : null}

        <View style={[styles.detailGrid, wide && styles.detailGridWide]}>
          <View style={styles.visualColumn}>
            <View style={[styles.visual, wide && styles.visualWide]}>
              {item.imageUri ? (
                <Image accessibilityLabel={`Photo of ${item.title}`} contentFit="cover" source={{ uri: item.imageUri }} style={StyleSheet.absoluteFill} />
              ) : (
                <CategoryArt category={item.category} size={280} style={{ width: '100%', height: '100%' }} />
              )}
            </View>
            <View style={styles.pills}>
              <StatusPill kind={item.kind} />
              <StatusPill status={item.status} />
            </View>
          </View>

          <View style={styles.copyColumn}>
            <View style={styles.titleBlock}>
              <AppText color={palette.wine} variant="micro">{getCategoryLabel(item.category).toUpperCase()}</AppText>
              <AppText accessibilityRole="header" variant="h1">{item.title}</AppText>
              <AppText color={palette.inkSoft} variant="body">{item.description}</AppText>
            </View>

            <View style={styles.metaGrid}>
              <Meta icon={MapPin} label="Area" value={item.location} />
              <Meta icon={Clock3} label={item.kind === 'found' ? 'Custody' : 'Report'} value={handoffLabel(item)} urgent={item.status === 'handoff_due'} />
            </View>

            {item.kind === 'found' ? (
              <Surface padding="md" tone={item.status === 'handoff_due' ? 'strong' : 'inset'} style={styles.handoffBox}>
                <Building2 color={item.status === 'handoff_due' ? palette.danger : palette.wine} size={23} />
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText color={item.status === 'handoff_due' ? palette.danger : palette.ink} variant="bodyStrong">
                    {item.status === 'at_office' ? 'Held by campus staff' : '24-hour custody route'}
                  </AppText>
                  <AppText color={palette.muted} variant="support">
                    {item.status === 'at_office'
                      ? `Collect from ${item.handoffPoint ?? 'the lost and found desk'} after verification.`
                      : `If unclaimed, this item goes to ${item.handoffPoint ?? 'the lost and found desk'}.`}
                  </AppText>
                  {handoffCode ? (
                    <View style={styles.handoffCode}>
                      <AppText color={palette.muted} variant="micro">STAFF HANDOFF CODE</AppText>
                      <AppText selectable style={styles.codeText} variant="h2">{handoffCode}</AppText>
                      <AppText color={palette.muted} variant="support">Show this only after staff receive the item.</AppText>
                    </View>
                  ) : canIssueHandoffCode ? (
                    <SecondaryButton
                      icon={KeyRound}
                      loading={handoffCodeLoading}
                      onPress={() => void createHandoffCode()}
                      style={styles.handoffAction}
                    >
                      Create handoff code
                    </SecondaryButton>
                  ) : null}
                </View>
              </Surface>
            ) : null}

            <Surface padding="lg" style={styles.contactCard}>
              <View style={styles.contactHeading}>
                <View style={styles.holderAvatar}>
                  <AppText color={palette.yellow} variant="bodyStrong">{item.holderName.slice(0, 1)}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{item.status === 'at_office' ? 'Campus Lost & Found' : item.holderName}</AppText>
                  <View style={styles.verifiedLine}>
                    <ShieldCheck color={palette.success} size={15} />
                    <AppText color={palette.success} variant="support">Verified campus contact</AppText>
                  </View>
                </View>
              </View>

              <View style={styles.maskedRow}>
                <Phone color={palette.wine} size={20} />
                <AppText variant="bodyStrong">{contact ?? item.maskedPhone}</AppText>
                {!contact ? <LockKeyhole color={palette.muted} size={17} /> : null}
              </View>

              {isAdmin ? (
                <AppText color={palette.muted} variant="support">Admin access is audited. Review claims in the operations workspace.</AppText>
              ) : ownsReport ? (
                <AppText color={palette.muted} variant="support">Your number stays masked until you approve an ownership claim.</AppText>
              ) : claimAccepted ? (
                <AppText color={palette.muted} variant="support">Claim approved. You can now explicitly reveal the contact number.</AppText>
              ) : myClaim?.status === 'pending' ? (
                <AppText color={palette.muted} variant="support">Claim pending. Contact stays masked until the report holder approves it.</AppText>
              ) : myClaim?.status === 'declined' ? (
                <AppText color={palette.muted} variant="support">That claim could not be verified. You may submit a clearer private detail.</AppText>
              ) : (
                <AppText color={palette.muted} variant="support">Submit a private ownership detail. Contact unlocks only after approval.</AppText>
              )}

              {contact ? (
                <PrimaryButton fullWidth icon={Phone} onPress={() => void Linking.openURL(`tel:${contact}`)}>Call contact</PrimaryButton>
              ) : isAdmin ? (
                <SecondaryButton fullWidth icon={ShieldCheck} onPress={() => router.replace('/admin')}>Open admin workspace</SecondaryButton>
              ) : ownsReport ? null : claimAccepted || revealedContactIds.includes(item.id) ? (
                <PrimaryButton fullWidth icon={Eye} onPress={() => void showContact()}>Reveal number</PrimaryButton>
              ) : myClaim?.status === 'pending' ? (
                <SecondaryButton disabled fullWidth icon={Clock3}>Awaiting review</SecondaryButton>
              ) : (
                <PrimaryButton fullWidth icon={ShieldCheck} onPress={() => setShowClaim(true)}>{claimLabel}</PrimaryButton>
              )}
            </Surface>

            {ownsReport && managedClaims.length ? (
              <Surface padding="lg" tone="strong" style={styles.claimBox}>
                <View style={styles.stepHeading}>
                  <AppText variant="h3">Ownership checks</AppText>
                  <AppText color={palette.muted} variant="support">Approve only when the private detail matches. The claimant sees your number only after approval.</AppText>
                </View>
                {managedClaims.map((claim) => (
                  <View key={claim.id} style={styles.reviewClaim}>
                    <View style={styles.reviewClaimHeading}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">{claim.claimantName ?? 'Verified student'}</AppText>
                        <AppText color={palette.muted} variant="micro">{new Date(claim.createdAt).toLocaleString()}</AppText>
                      </View>
                      <StatusPill label={claim.status} tone={claim.status === 'accepted' ? 'success' : claim.status === 'declined' ? 'danger' : 'warning'} />
                    </View>
                    <Surface padding="md" tone="inset">
                      <AppText color={palette.muted} variant="micro">PRIVATE ANSWER</AppText>
                      <AppText variant="support">{claim.note}</AppText>
                    </Surface>
                    {claim.status === 'pending' ? (
                      <View style={styles.claimActions}>
                        <SecondaryButton onPress={() => void reviewClaim(claim.id, false)}>Decline</SecondaryButton>
                        <PrimaryButton onPress={() => void reviewClaim(claim.id, true)}>Approve claim</PrimaryButton>
                      </View>
                    ) : null}
                  </View>
                ))}
                {canConfirmDirectReturn ? (
                  <View style={styles.returnBox}>
                    <View style={{ flex: 1, gap: spacing.xxs }}>
                      <AppText variant="bodyStrong">Complete the handover</AppText>
                      <AppText color={palette.muted} variant="support">Confirm only after the verified owner or finder has the item.</AppText>
                    </View>
                    {returnConfirm ? (
                      <View style={styles.claimActions}>
                        <TextButton onPress={() => setReturnConfirm(false)}>Cancel</TextButton>
                        <PrimaryButton
                          icon={CheckCircle2}
                          loading={returnLoading}
                          onPress={() => void confirmReturn()}
                        >
                          Mark returned
                        </PrimaryButton>
                      </View>
                    ) : (
                      <SecondaryButton icon={CheckCircle2} onPress={() => setReturnConfirm(true)}>Confirm return</SecondaryButton>
                    )}
                  </View>
                ) : null}
              </Surface>
            ) : null}

            {showClaim ? (
              <Surface padding="lg" tone="strong" style={styles.claimBox}>
                <View style={styles.stepHeading}>
                  <AppText variant="h3">Verify before contact</AppText>
                  <AppText color={palette.muted} variant="support">{item.privateClue ?? 'Share one detail only the owner would know.'}</AppText>
                </View>
                <TextArea
                  autoFocus
                  label="Your private answer"
                  onChangeText={setProof}
                  placeholder="Be specific. Your answer is not public."
                  value={proof}
                />
                <View style={styles.claimActions}>
                  <TextButton onPress={() => { setShowClaim(false); setError(''); }}>Cancel</TextButton>
                  <PrimaryButton onPress={() => void submitClaim()}>Send claim</PrimaryButton>
                </View>
              </Surface>
            ) : null}

            {error ? <AppText accessibilityLiveRegion="polite" color={palette.danger} variant="support">{error}</AppText> : null}
          </View>
        </View>

        <View style={styles.safetyFooter}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong">Meet somewhere staffed and public.</AppText>
            <AppText color={palette.muted} variant="support">Never share passwords, PINs or payment details.</AppText>
          </View>
          <SecondaryButton
            disabled={flaggedItemIds.includes(item.id)}
            icon={Flag}
            onPress={() => { setShowFlag((current) => !current); setError(''); }}
          >
            {flaggedItemIds.includes(item.id) ? 'Sent for review' : showFlag ? 'Cancel report' : 'Report listing'}
          </SecondaryButton>
        </View>

        {showFlag && !flaggedItemIds.includes(item.id) ? (
          <Surface padding="lg" tone="strong" style={styles.flagBox}>
            <View style={styles.stepHeading}>
              <AppText variant="h3">Send to campus staff</AppText>
              <AppText color={palette.muted} variant="support">Describe inaccurate, unsafe or inappropriate content. Your report is not public.</AppText>
            </View>
            <TextArea
              label="What needs review?"
              maxLength={500}
              onChangeText={setFlagDetails}
              placeholder="Give staff enough detail to check the listing."
              value={flagDetails}
            />
            <View style={styles.claimActions}>
              <TextButton onPress={() => { setShowFlag(false); setError(''); }}>Cancel</TextButton>
              <PrimaryButton disabled={flagDetails.trim().length < 10} onPress={() => void reportListing()}>Send report</PrimaryButton>
            </View>
          </Surface>
        ) : null}
      </ContentShell>
    </Screen>
  );
}

function Meta({ icon: Icon, label, value, urgent = false }: { icon: typeof MapPin; label: string; value: string; urgent?: boolean }) {
  return (
    <View style={styles.meta}>
      <View style={[styles.metaIcon, urgent && styles.metaIconUrgent]}>
        <Icon color={urgent ? palette.danger : palette.wine} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText color={palette.muted} variant="micro">{label.toUpperCase()}</AppText>
        <AppText color={urgent ? palette.danger : palette.ink} variant="support">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.lg, paddingTop: spacing.md },
  topbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  createdBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderColor: palette.success },
  detailGrid: { gap: spacing.xl },
  detailGridWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxl },
  visualColumn: { flex: 0.85, gap: spacing.md },
  visual: { height: 300, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: palette.inset },
  visualWide: { height: 440 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  copyColumn: { flex: 1, gap: spacing.lg },
  titleBlock: { gap: spacing.sm },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  meta: { minWidth: 220, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.wineSoft },
  metaIconUrgent: { backgroundColor: palette.dangerSoft },
  handoffBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  handoffCode: { gap: spacing.xxs, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.lineSoft },
  handoffAction: { marginTop: spacing.sm },
  codeText: { color: palette.wine, letterSpacing: 3 },
  contactCard: { gap: spacing.md },
  contactHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  holderAvatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.wine },
  verifiedLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  maskedRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: palette.inset },
  claimBox: { gap: spacing.md },
  stepHeading: { gap: spacing.xs },
  claimActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  reviewClaim: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.lineSoft },
  returnBox: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.lineSoft },
  reviewClaimHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  safetyFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: palette.lineSoft },
  flagBox: { gap: spacing.md, marginBottom: spacing.lg },
});
