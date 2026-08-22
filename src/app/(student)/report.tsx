import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, Check, Clock3, LockKeyhole, MapPin, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
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
import { palette, radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { categories, handoffPoints } from '@/lib/mock-data';
import type { ItemCategory, ItemKind, ReportDraft } from '@/lib/types';
import { useAppState } from '@/state';

type TimeChoice = 'now' | 'earlier' | 'yesterday' | 'custom';

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
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const { createReport, loading } = useAppState();
  const [referenceNow] = useState(() => Date.now());
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<ItemKind>('found');
  const [category, setCategory] = useState<ItemCategory>('electronics');
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
      setImageUri(result.assets[0]?.uri);
      setError('');
      void haptics.select();
    }
  };

  const validateStep = () => {
    if (step === 0 && (title.trim().length < 2 || color.trim().length < 2)) {
      setError('Use at least 2 characters for the title and colour.');
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
    const result = await createReport(draft);
    if (!result.ok) return setError(result.error);
    router.replace({ pathname: '/item/[id]', params: { id: result.data.id, created: '1' } });
  };

  return (
    <Screen>
      <ContentShell maxWidth={840} style={styles.shell}>
        <View style={styles.heading}>
          <AppText color={palette.wine} variant="micro">NEW REPORT</AppText>
          <AppText accessibilityRole="header" variant="h1">Help it find its way.</AppText>
          <AppText color={palette.muted} variant="body">Clear details. One private clue. Safer returns.</AppText>
        </View>

        <View accessibilityLabel={`Step ${step + 1} of 3`} style={styles.progress}>
          {progress.map((active, index) => (
            <View key={index} style={styles.progressGroup}>
              <View style={[styles.stepDot, active && styles.stepDotActive]}>
                {index < step
                  ? <Check color={palette.white} size={15} strokeWidth={3} />
                  : <AppText color={active ? palette.white : palette.muted} variant="micro">{index + 1}</AppText>}
              </View>
              {index < 2 ? <View style={[styles.progressLine, index < step && styles.progressLineActive]} /> : null}
            </View>
          ))}
        </View>

        <Surface padding={compact ? 'md' : 'xl'} style={styles.form}>
          {step === 0 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText variant="h2">What happened?</AppText>
                <AppText color={palette.muted} variant="body">Start with what another student can recognise.</AppText>
              </View>
              <SegmentedControl
                label="Report type"
                onChange={(value) => { setKind(value); void haptics.select(); }}
                options={[{ label: 'I found it', value: 'found' }, { label: 'I lost it', value: 'lost' }]}
                value={kind}
              />
              <View style={[styles.photoRow, !compact && styles.photoRowWide]}>
                <View style={styles.photoPreview}>
                  {imageUri
                    ? <Image accessibilityLabel="Selected item photo" contentFit="cover" source={{ uri: imageUri }} style={StyleSheet.absoluteFill} />
                    : <CategoryArt category={category} size={compact ? 120 : 156} style={{ width: '100%', height: '100%' }} />}
                </View>
                <View style={styles.photoCopy}>
                  <AppText variant="bodyStrong">Add a clear photo</AppText>
                  <AppText color={palette.muted} variant="support">Avoid faces, student cards and private documents.</AppText>
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
                <AppText variant="h2">Where and when?</AppText>
                <AppText color={palette.muted} variant="body">Approximate places protect privacy while helping people search.</AppText>
              </View>
              <TextField
                label={kind === 'found' ? 'Where was it found?' : 'Where was it last seen?'}
                leading={<MapPin color={palette.muted} size={20} />}
                onChangeText={setLocation}
                placeholder="Main library, level 2"
                value={location}
              />
              <View style={styles.choiceGroup}>
                <View style={styles.choiceLabel}>
                  <Clock3 color={palette.wine} size={18} />
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
                <LockKeyhole color={palette.wine} size={24} />
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText variant="bodyStrong">Keep one detail private</AppText>
                  <AppText color={palette.muted} variant="support">We show the question, never your expected answer.</AppText>
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
                  <AppText color={palette.muted} variant="support">If unclaimed after 24 hours, take it here.</AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stepContent}>
              <View style={styles.stepHeading}>
                <AppText variant="h2">Ready to publish?</AppText>
                <AppText color={palette.muted} variant="body">Only verified people at your campus will see this report.</AppText>
              </View>
              <Surface padding="md" tone="strong" style={styles.reviewCard}>
                <CategoryArt category={category} size={112} />
                <View style={styles.reviewCopy}>
                  <AppText color={palette.muted} variant="micro">{kind.toUpperCase()} · {getCategoryLabel(category).toUpperCase()}</AppText>
                  <AppText variant="h3">{title}</AppText>
                  <AppText color={palette.inkSoft} variant="support">{color} · {location}</AppText>
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

          {error ? <AppText accessibilityLiveRegion="polite" color={palette.danger} variant="support">{error}</AppText> : null}

          <View style={styles.actions}>
            {step > 0 ? (
              <TextButton icon={ArrowLeft} onPress={() => { setStep((current) => current - 1); setError(''); }}>Back</TextButton>
            ) : <View />}
            {step < 2
              ? <PrimaryButton icon={ArrowRight} iconPosition="right" onPress={next}>Continue</PrimaryButton>
              : <PrimaryButton icon={Check} loading={loading} onPress={() => void publish()}>Publish report</PrimaryButton>}
          </View>
        </Surface>
      </ContentShell>
    </Screen>
  );
}

function ReviewRow({ icon: Icon, title, copy }: { icon: typeof Clock3; title: string; copy: string }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewIcon}><Icon color={palette.wine} size={20} /></View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText color={palette.muted} variant="support">{copy}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.xl, paddingTop: spacing.xl },
  heading: { gap: spacing.xs },
  progress: { flexDirection: 'row', alignItems: 'center', maxWidth: 420, alignSelf: 'center' },
  progressGroup: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceStrong },
  stepDotActive: { backgroundColor: palette.wine, borderColor: palette.wine },
  progressLine: { flex: 1, height: 2, backgroundColor: palette.lineSoft },
  progressLineActive: { backgroundColor: palette.wine },
  form: { gap: spacing.lg },
  stepContent: { gap: spacing.lg },
  stepHeading: { gap: spacing.xs },
  photoRow: { gap: spacing.md },
  photoRowWide: { flexDirection: 'row', alignItems: 'center' },
  photoPreview: { width: 156, height: 132, alignSelf: 'center', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: palette.inset },
  photoCopy: { flex: 1, gap: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fieldRow: { gap: spacing.md },
  fieldRowWide: { flexDirection: 'row' },
  choiceGroup: { gap: spacing.sm },
  choiceLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  privateBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewCopy: { flex: 1, gap: spacing.xs },
  reviewList: { gap: spacing.sm },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.wineSoft },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.sm },
});
