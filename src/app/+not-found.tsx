import { router } from 'expo-router';

import { ContentShell, EmptyState, Screen, TextButton } from '@/components/strathfind';
import { spacing } from '@/constants/design';

export default function NotFoundScreen() {
  return (
    <Screen contentContainerStyle={{ justifyContent: 'center' }}>
      <ContentShell maxWidth={680} style={{ gap: spacing.md }}>
        <TextButton onPress={() => router.back()}>Go back</TextButton>
        <EmptyState
          actionLabel="Go home"
          message="The page may have moved, or the report may have been closed."
          onAction={() => router.replace('/')}
          title="Nothing here"
        />
      </ContentShell>
    </Screen>
  );
}
