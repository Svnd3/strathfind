import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, Check, Clock3, LockKeyhole, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  CampusLocationField,
  CategoryArt,
  Chip,
  ContentShell,
  IconButton,
  PrimaryButton,
  Screen,
  SegmentedControl,
  Surface,
  TextArea,
  TextButton,
  TextField,
  getCategoryLabel,
} from '@/components/strathfind';
import { radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { categories, handoffPoints } from '@/lib/catalog';
import { readPreference, writePreference } from '@/lib/preferences';
import { parseReportOccurrence, validateReportStep } from '@/lib/report-form';
import type { ItemCategory, ItemKind, ReportDraft } from '@/lib/types';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

type TimeChoice = 'now' | 'earlier' | 'yesterday' | 'custom';
const PENDING_REPORT_KEY = 'strathfind.pending-report.v1';
const stepLabels = ['Item details', 'Where and when', 'Review'] as const;

interface PendingReport {
  savedAt: string;
  kind: ItemKind;
  category: ItemCategory | null;
  title: string;
  color: string;
  description: string;
  location: string;
  occurrenceDate: string;
  occurrenceTime: string;
  timeChoice: TimeChoice;
  privateClue: string;
  handoffPoint: string;
  imageUri?: string;
}

function toLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function quickTime(choice: Exclude<TimeChoice, 'custom'>) {
  const offset = choice === 'now' ? 0 : choice === 'earlier' ? 4 : 24;
  return new Date(Date.now() - offset * 3_600_000);
}

export default function ReportScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ kind?: string; restore?: string }>();
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const { createReport, isAuthenticated, loading } = useAppState();
  const [referenceNow] = useState(() => Date.now());
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [kind, setKind] = useState<ItemKind>(params.kind === 'lost' ? 'lost' : 'found');
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [timeChoice, setTimeChoice] = useState<TimeChoice>('now');
  const [occurrenceDate, setOccurrenceDate] = useState(() => toLocalDate(new Date()));
  const [occurrenceTime, setOccurrenceTime] = useState(() => toLocalTime(new Date()));
  const [privateClue, setPrivateClue] = useState('');
  const [handoffPoint, setHandoffPoint] = useState<string>(handoffPoints[0]);
  const [imageUri, setImageUri] = useState<string>();
  const [error, setError] = useState('');

  const reportValues = useMemo(
    () => ({
      category,
      title,
      color,
      location,
      privateClue,
      occurrenceDate,
      occurrenceTime,
    }),
    [category, color, location, occurrenceDate, occurrenceTime, privateClue, title],
  );
  const occurredAt = useMemo(
    () => parseReportOccurrence(occurrenceDate, occurrenceTime),
    [occurrenceDate, occurrenceTime],
  );
  const progressWidth: `${number}%` = step === 0 ? '33.333%' : step === 1 ? '66.667%' : '100%';
  const handoffDeadline = occurredAt
    ? new Date(occurredAt.getTime() + 24 * 3_600_000)
    : null;

  useEffect(() => {
    if (params.restore !== '1') return;
    void readPreference<PendingReport | null>(PENDING_REPORT_KEY, null).then((draft) => {
      if (!draft || Date.now() - new Date(draft.savedAt).getTime() > 24 * 3_600_000) return;
      setKind(draft.kind);
      setCategory(draft.category);
      setTitle(draft.title);
      setColor(draft.color);
      setDescription(draft.description);
      setLocation(draft.location);
      setOccurrenceDate(draft.occurrenceDate);
      setOccurrenceTime(draft.occurrenceTime);
      setTimeChoice(draft.timeChoice);
      setPrivateClue(draft.privateClue);
      setHandoffPoint(draft.handoffPoint);
      setImageUri(draft.imageUri);
      const restoredValues = {
        category: draft.category,
        title: draft.title,
        color: draft.color,
        location: draft.location,
        privateClue: draft.privateClue,
        occurrenceDate: draft.occurrenceDate,
        occurrenceTime: draft.occurrenceTime,
      };
      const itemError = validateReportStep(0, restoredValues);
      const placeError = validateReportStep(1, restoredValues);
      setStep(itemError ? 0 : placeError ? 1 : 2);
      setError(itemError ?? placeError ?? '');
    });
  }, [params.restore]);

  const selectQuickTime = (choice: Exclude<TimeChoice, 'custom'>) => {
    const value = quickTime(choice);
    setTimeChoice(choice);
    setOccurrenceDate(toLocalDate(value));
    setOccurrenceTime(toLocalTime(value));
    void haptics.select();
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is needed to attach an image. You can still report without one.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.72,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset?.fileSize && asset.fileSize > 8 * 1024 * 1024) {
        setError('Choose an image smaller than 8 MB.');
        return;
      }
      if (asset?.mimeType && !asset.mimeType.startsWith('image/')) {
        setError('Choose a photo file.');
        return;
      }
      setImageUri(asset?.uri);
      setError('');
      void haptics.select();
    }
  };

  const next = () => {
    if (step === 2) return;
    const validationError = validateReportStep(step, reportValues);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep(step === 0 ? 1 : 2);
    void haptics.select();
  };

  const publish = async () => {
    const itemError = validateReportStep(0, reportValues);
    if (itemError) {
      setError(itemError);
      setStep(0);
      return;
    }
    if (!category) {
      setError('Choose a category, then add a short title and colour.');
      setStep(0);
      return;
    }
    const placeError = validateReportStep(1, reportValues);
    if (placeError || !occurredAt) {
      setError(placeError ?? 'Enter a valid date and time that is not in the future.');
      setStep(1);
      return;
    }
    const draft: ReportDraft = {
      kind,
      title,
      category,
      color,
      description,
      location,
      foundAt: occurredAt,
      imageUri,
      privateClue,
      handoffPoint,
    };
    if (!isAuthenticated) {
      await writePreference<PendingReport>(PENDING_REPORT_KEY, {
        savedAt: new Date().toISOString(),
        kind,
        category,
        title,
        color,
        description,
        location,
        occurrenceDate,
        occurrenceTime,
        timeChoice,
        privateClue,
        handoffPoint,
        imageUri,
      });
      router.push({
        pathname: '/auth',
        params: { mode: 'sign-in', returnTo: '/report-found?restore=1' },
      });
      return;
    }
    const result = await createReport(draft);
    if (!result.ok) return setError(result.error);
    await writePreference(PENDING_REPORT_KEY, null);
    router.replace({ pathname: '/item/[id]', params: { id: result.data.id, created: '1' } });
  };

  return (
    <Screen>
      <ContentShell maxWidth={680} style={styles.shell}>
        <View style={styles.heading}>
          <TextButton icon={ArrowLeft} onPress={() => router.back()}>Back</TextButton>
          <View style={styles.titleBlock}>
            <AppText accessibilityRole="header" variant="h1">Report an item</AppText>
            <AppText color={colors.muted} variant="body">
              Share clear public details, and keep one identifying clue private.
            </AppText>
          </View>
        </View>

        <View
          accessibilityLabel={`Step ${step + 1} of 3, ${stepLabels[step]}`}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: 3, now: step + 1, text: stepLabels[step] }}
          style={styles.progressBlock}
        >
          <AppText color={colors.muted} variant="micro">
            STEP {step + 1} OF 3 · {stepLabels[step].toUpperCase()}
          </AppText>
          <View style={[styles.progressTrack, { backgroundColor: colors.lineSoft }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: progressWidth }]} />
          </View>
        </View>

        <View style={styles.form}>
          {step === 0 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText accessibilityRole="header" variant="h2">Item details</AppText>
                <AppText color={colors.muted} variant="support">
                  Add enough detail for someone to recognise the item.
                </AppText>
              </View>
              <SegmentedControl
                label="Report type"
                onChange={(value) => { setKind(value); void haptics.select(); }}
                options={[{ label: 'I found it', value: 'found' }, { label: 'I lost it', value: 'lost' }]}
                value={kind}
              />
              <View style={styles.choiceGroup}>
                <AppText variant="support">Category</AppText>
                <View style={styles.chipWrap}>
                  {categories.map((value) => (
                    <Chip key={value} label={getCategoryLabel(value)} onPress={() => setCategory(value)} selected={category === value} />
                  ))}
                </View>
              </View>
              <View style={[styles.fieldRow, !compact && styles.fieldRowWide]}>
                <TextField
                  containerStyle={{ flex: 2 }}
                  label="Short title"
                  maxLength={48}
                  onChangeText={setTitle}
                  placeholder={kind === 'found' ? 'Black earbuds case' : 'Grey laptop bag'}
                  value={title}
                />
                <TextField
                  containerStyle={{ flex: 1 }}
                  label="Colour"
                  maxLength={24}
                  onChangeText={setColor}
                  placeholder="Black"
                  value={color}
                />
              </View>
              <TextArea
                label="Useful description"
                maxLength={240}
                onChangeText={setDescription}
                placeholder="A few visible details. Keep one identifying detail private."
                value={description}
              />
              <View style={[styles.photoRow, { borderColor: colors.lineSoft }]}>
                <View style={[styles.photoPreview, { backgroundColor: colors.inset }]}>
                  {imageUri
                    ? <Image accessibilityLabel="Selected item photo" contentFit="cover" source={{ uri: imageUri }} style={StyleSheet.absoluteFill} />
                    : <Camera aria-hidden color={colors.wine} size={24} strokeWidth={2} />}
                </View>
                <View style={styles.photoCopy}>
                  <AppText variant="bodyStrong">Photo · optional</AppText>
                  <AppText color={colors.muted} variant="support">Avoid faces and ID numbers.</AppText>
                </View>
                <IconButton
                  accessibilityLabel={imageUri ? 'Change item photo' : 'Add item photo'}
                  icon={Camera}
                  onPress={() => void pickImage()}
                />
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText accessibilityRole="header" variant="h2">Where and when</AppText>
                <AppText color={colors.muted} variant="support">
                  This helps narrow matches around campus.
                </AppText>
              </View>
              <CampusLocationField
                label={kind === 'found' ? 'Where was it found?' : 'Where was it last seen?'}
                onChangeText={setLocation}
                value={location}
              />
              <View style={styles.choiceGroup}>
                <View style={styles.choiceLabel}>
                  <Clock3 color={colors.wine} size={18} />
                  <AppText variant="support">{kind === 'found' ? 'Found' : 'Last seen'}</AppText>
                </View>
                <View style={styles.chipWrap}>
                  {([
                    ['now', 'Just now'],
                    ['earlier', 'Earlier today'],
                    ['yesterday', 'Yesterday'],
                  ] as const).map(([value, label]) => (
                    <Chip key={value} label={label} onPress={() => selectQuickTime(value)} selected={timeChoice === value} />
                  ))}
                </View>
              </View>
              <View style={[styles.fieldRow, !compact && styles.fieldRowWide]}>
                <TextField
                  autoCapitalize="none"
                  containerStyle={{ flex: 1 }}
                  label="Date"
                  maxLength={10}
                  onChangeText={(value) => { setOccurrenceDate(value); setTimeChoice('custom'); }}
                  placeholder="YYYY-MM-DD"
                  value={occurrenceDate}
                />
                <TextField
                  autoCapitalize="none"
                  containerStyle={{ flex: 1 }}
                  label="Time"
                  maxLength={5}
                  onChangeText={(value) => { setOccurrenceTime(value); setTimeChoice('custom'); }}
                  placeholder="HH:MM"
                  value={occurrenceTime}
                />
              </View>
              <TextArea
                helpText="Only claim reviewers see this. Use a detail that is not in the public description."
                label="Private ownership clue"
                maxLength={140}
                onChangeText={setPrivateClue}
                placeholder="What is written on the sticker underneath?"
                value={privateClue}
              />
              {kind === 'found' ? (
                <View style={styles.choiceGroup}>
                  <AppText variant="support">Official handoff point</AppText>
                  <View style={styles.chipWrap}>
                    {handoffPoints.map((point) => (
                      <Chip key={point} label={point} onPress={() => setHandoffPoint(point)} selected={handoffPoint === point} />
                    ))}
                  </View>
                  <AppText color={colors.muted} variant="support">
                    If it remains unclaimed for 24 hours, take it here.
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText accessibilityRole="header" variant="h2">Review</AppText>
                <AppText color={colors.muted} variant="support">
                  Check the public details before publishing.
                </AppText>
              </View>
              <Surface padding="md" tone="strong" style={styles.reviewCard}>
                {imageUri ? (
                  <Image
                    accessibilityLabel={`Photo of ${title}`}
                    contentFit="cover"
                    source={{ uri: imageUri }}
                    style={[styles.reviewImage, compact && styles.reviewImageCompact]}
                  />
                ) : category ? (
                  <CategoryArt category={category} size={compact ? 88 : 112} />
                ) : null}
                <View style={styles.reviewCopy}>
                  <AppText color={colors.muted} variant="micro">{kind.toUpperCase()} · {category ? getCategoryLabel(category).toUpperCase() : 'UNCATEGORISED'}</AppText>
                  <AppText variant="h3">{title}</AppText>
                  <AppText color={colors.inkSoft} variant="support">{color} · {location}</AppText>
                </View>
              </Surface>
              <View style={styles.reviewList}>
                <ReviewRow icon={LockKeyhole} title="Private clue" copy={privateClue} />
                {kind === 'found' ? (
                  <ReviewRow
                    icon={Clock3}
                    title={handoffDeadline && handoffDeadline.getTime() <= referenceNow ? 'Immediate handoff' : '24-hour handoff'}
                    copy={handoffDeadline && handoffDeadline.getTime() <= referenceNow
                      ? `Take it to ${handoffPoint} now.`
                      : `Due ${handoffDeadline?.toLocaleString() ?? 'after 24 hours'} at ${handoffPoint}.`}
                  />
                ) : (
                  <ReviewRow icon={Search} title="Match check" copy="Possible matches will appear in Activity." />
                )}
              </View>
            </View>
          ) : null}

          {error ? <AppText accessibilityLiveRegion="polite" color={colors.danger} variant="support">{error}</AppText> : null}

          <View
            style={[
              styles.actions,
              compact && styles.actionsCompact,
              step === 0 && !compact && styles.actionsEnd,
            ]}
          >
            {step > 0 ? (
              <TextButton
                fullWidth={compact}
                icon={ArrowLeft}
                onPress={() => {
                  setStep((current) => current === 2 ? 1 : 0);
                  setError('');
                }}
              >
                Previous
              </TextButton>
            ) : null}
            {step < 2
              ? <PrimaryButton fullWidth={compact} icon={ArrowRight} iconPosition="right" onPress={next}>Continue</PrimaryButton>
              : <PrimaryButton fullWidth={compact} icon={isAuthenticated ? Check : LockKeyhole} loading={loading} onPress={() => void publish()}>
                  {isAuthenticated ? 'Publish report' : 'Sign in to publish'}
                </PrimaryButton>}
          </View>
        </View>
      </ContentShell>
    </Screen>
  );
}

function ReviewRow({ icon: Icon, title, copy }: { icon: typeof Clock3; title: string; copy: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.reviewRow}>
      <View style={[styles.reviewIcon, { backgroundColor: colors.wineSoft }]}>
        <Icon color={colors.wine} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText color={colors.muted} variant="support">{copy}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.lg, paddingTop: spacing.lg },
  heading: { gap: spacing.sm },
  titleBlock: { gap: spacing.xs },
  progressBlock: { width: '100%', gap: spacing.xs },
  progressTrack: { width: '100%', height: 4, overflow: 'hidden', borderRadius: radius.pill },
  progressFill: { height: '100%', borderRadius: radius.pill },
  form: { gap: spacing.lg, paddingBottom: spacing.lg },
  stepContent: { gap: spacing.lg },
  stepHeading: { gap: spacing.xs },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  photoPreview: {
    width: 72,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.sm,
  },
  photoCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fieldRow: { gap: spacing.md },
  fieldRowWide: { flexDirection: 'row' },
  choiceGroup: { gap: spacing.sm },
  choiceLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewImage: { width: 112, height: 112, borderRadius: radius.lg },
  reviewImageCompact: { width: 88, height: 88, borderRadius: radius.md },
  reviewCopy: { flex: 1, gap: spacing.xs },
  reviewList: { gap: spacing.sm },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.sm },
  actionsCompact: { flexDirection: 'column', alignItems: 'stretch' },
  actionsEnd: { justifyContent: 'flex-end' },
});
