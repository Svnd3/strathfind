import { View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radius, spacing } from '@/constants/design';
import type { ItemKind, ItemStatus } from '@/lib/types';

import { AppText } from './typography';

type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const statusContent: Record<ItemStatus, { label: string; tone: StatusTone }> = {
  published: { label: 'Open', tone: 'info' },
  claim_pending: { label: 'Claim pending', tone: 'warning' },
  pickup_agreed: { label: 'Pickup agreed', tone: 'info' },
  handoff_due: { label: 'Handoff due', tone: 'danger' },
  at_office: { label: 'At lost & found', tone: 'neutral' },
  returned: { label: 'Returned', tone: 'success' },
};

const toneColors: Record<StatusTone, { background: string; foreground: string }> = {
  neutral: { background: palette.inset, foreground: palette.inkSoft },
  info: { background: palette.blueSoft, foreground: palette.blue },
  warning: { background: palette.warningSoft, foreground: palette.warning },
  success: { background: palette.successSoft, foreground: palette.success },
  danger: { background: palette.dangerSoft, foreground: palette.danger },
};

export interface StatusPillProps {
  status?: ItemStatus;
  kind?: ItemKind;
  label?: string;
  tone?: StatusTone;
  style?: StyleProp<ViewStyle>;
}

export function StatusPill({ status, kind, label, tone, style }: StatusPillProps) {
  const content = status
    ? statusContent[status]
    : kind
      ? { label: kind === 'found' ? 'Found' : 'Lost', tone: kind === 'found' ? ('success' as const) : ('warning' as const) }
      : { label: label ?? 'Open', tone: tone ?? ('neutral' as const) };
  const colors = toneColors[tone ?? content.tone];

  return (
    <View
      accessibilityLabel={`Status: ${label ?? content.label}`}
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
          borderRadius: radius.pill,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      <AppText variant="micro" color={colors.foreground}>
        {label ?? content.label}
      </AppText>
    </View>
  );
}
