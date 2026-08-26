import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, Check, Clock3, LockKeyhole, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  CampusLocationField,
  CategoryArt,
  Chip,
  ContentShell,
  PrimaryButton,
  Screen,
  SecondaryButton,
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
import type { ItemCategory, ItemKind, ReportDraft } from '@/lib/types';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

type TimeChoice = 'now' | 'earlier' | 'yesterday' | 'custom';
const PENDING_REPORT_KEY = 'strathfind.pending-report.v1';
const stepLabels = ['Item', 'Place', 'Review'] as const;

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

function parseOccurrence(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
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
  const [step, setStep] = useState(0);
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

  const progress = useMemo(() => [0, 1, 2].map((value) => value <= step), [step]);
  const occurredAt = useMemo(
    () => parseOccurrence(occurrenceDate, occurrenceTime),
    [occurrenceDate, occurrenceTime],
  );
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
      setStep(2);
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

  const validateStep = () => {
    if (step === 0 && (!category || title.trim().length < 2 || color.trim().length < 2)) {
      setError('Choose a category, then add a short title and colour.');
      return false;
    }
    if (step === 1 && (location.trim().length < 2 || privateClue.trim().length < 5)) {
      setError('Add a location and a useful private clue.');
      return false;
    }
    if (step === 1 && (!occurredAt || occurredAt.getTime() > Date.now() + 5 * 60_000)) {
      setError('Enter a valid date and time that is not in the future.');
      return false;
    }
    setError('');
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(2, current + 1));
    void haptics.select();
  };

  const publish = async () => {
    if (!occurredAt) {
      setError('Enter a valid date and time.');
      return;
    }
    if (!category) {
      setError('Choose a category.');
      setStep(0);
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
      <ContentShell maxWidth={840} style={styles.shell}>
        <View style={styles.heading}>
          <TextButton icon={ArrowLeft} onPress={() => router.back()}>Back</TextButton>
          <AppText accessibilityRole="header" variant="h1">Report {kind}</AppText>
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
          <View style={styles.progress}>
          {progress.map((active, index) => (
            <View key={index} style={styles.progressGroup}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: colors.surfaceStrong, borderColor: colors.line },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {index < step
                  ? <Check color={colors.onPrimary} size={15} strokeWidth={3} />
                  : <AppText color={active ? colors.onPrimary : colors.muted} variant="micro">{index + 1}</AppText>}
              </View>
              {index < 2 ? (
                <View
                  style={[
                    styles.progressLine,
                    { backgroundColor: index < step ? colors.primary : colors.lineSoft },
                  ]}
                />
              ) : null}
            </View>
          ))}
          </View>
        </View>

        <Surface padding={compact ? 'md' : 'xl'} tone="strong" style={styles.form}>
          {step === 0 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText variant="h2">Item</AppText>
              </View>
              <SegmentedControl
                label="Report type"
                onChange={(value) => { setKind(value); void haptics.select(); }}
                options={[{ label: 'I found it', value: 'found' }, { label: 'I lost it', value: 'lost' }]}
                value={kind}
              />
              <View style={[styles.photoRow, !compact && styles.photoRowWide]}>
                <Pressable
                  accessibilityLabel={imageUri ? 'Change item photo' : 'Add item photo, optional'}
                  accessibilityRole="button"
                  onPress={() => void pickImage()}
                  style={({ pressed }) => [
                    styles.photoPreview,
                    { backgroundColor: colors.inset, borderColor: colors.line },
                    pressed && { opacity: 0.78 },
                  ]}
                >
                  {imageUri
                    ? <Image accessibilityLabel="Selected item photo" contentFit="cover" source={{ uri: imageUri }} style={StyleSheet.absoluteFill} />
                    : (
                      <View style={styles.emptyPhoto}>
                        <Camera aria-hidden color={colors.wine} size={30} strokeWidth={2} />
                        <AppText color={colors.wine} variant="micro">ADD PHOTO</AppText>
                      </View>
                    )}
                </Pressable>
                <View style={styles.photoCopy}>
                  <AppText variant="bodyStrong">Photo · optional</AppText>
                  <AppText color={colors.muted} variant="support">Avoid faces and ID numbers.</AppText>
                  <SecondaryButton icon={Camera} onPress={() => void pickImage()}>{imageUri ? 'Change photo' : 'Choose photo'}</SecondaryButton>
                </View>
              </View>
              <AppText variant="support">Category</AppText>
              <View style={styles.chipWrap}>
                {categories.map((value) => (
                  <Chip key={value} label={getCategoryLabel(value)} onPress={() => setCategory(value)} selected={category === value} />
                ))}
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
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText variant="h2">Place &amp; time</AppText>
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
              <Surface padding="md" tone="inset" style={styles.privateBox}>
                <LockKeyhole color={colors.wine} size={24} />
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText variant="bodyStrong">Private clue</AppText>
                  <AppText color={colors.muted} variant="support">Used to verify the owner.</AppText>
                </View>
              </Surface>
              <TextArea
                label="Ownership check"
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
                  <AppText color={colors.muted} variant="support">Unclaimed after 24h? Take it here.</AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText variant="h2">Review</AppText>
              </View>
              <Surface padding="md" tone="strong" style={styles.reviewCard}>
                {imageUri ? (
                  <Image accessibilityLabel={`Photo of ${title}`} contentFit="cover" source={{ uri: imageUri }} style={styles.reviewImage} />
                ) : category ? (
                  <CategoryArt category={category} size={112} />
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

          <View style={styles.actions}>
            {step > 0 ? (
              <TextButton icon={ArrowLeft} onPress={() => { setStep((current) => current - 1); setError(''); }}>Back</TextButton>
            ) : <View />}
            {step < 2
              ? <PrimaryButton icon={ArrowRight} iconPosition="right" onPress={next}>Continue</PrimaryButton>
              : <PrimaryButton icon={isAuthenticated ? Check : LockKeyhole} loading={loading} onPress={() => void publish()}>
                  {isAuthenticated ? 'Publish report' : 'Sign in to publish'}
                </PrimaryButton>}
          </View>
        </Surface>
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
  shell: { gap: spacing.xl, paddingTop: spacing.xl },
  heading: { gap: spacing.md },
  progressBlock: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: spacing.xs },
  progress: { flexDirection: 'row', alignItems: 'center', maxWidth: 420, alignSelf: 'center' },
  progressGroup: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  progressLine: { flex: 1, height: 2 },
  form: { gap: spacing.lg },
  stepContent: { gap: spacing.lg },
  stepHeading: { gap: spacing.xs },
  photoRow: { gap: spacing.md },
  photoRowWide: { flexDirection: 'row', alignItems: 'center' },
  photoPreview: {
    width: 164,
    height: 164,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  photoCopy: { flex: 1, gap: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fieldRow: { gap: spacing.md },
  fieldRowWide: { flexDirection: 'row' },
  choiceGroup: { gap: spacing.sm },
  choiceLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  privateBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewImage: { width: 112, height: 112, borderRadius: radius.lg },
  reviewCopy: { flex: 1, gap: spacing.xs },
  reviewList: { gap: spacing.sm },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.sm },
});
