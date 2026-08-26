import { router } from 'expo-router';
import { ArrowLeft, FileCheck2, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  ContentShell,
  IconButton,
  Screen,
  Surface,
} from '@/components/strathfind';
import { radius, spacing } from '@/constants/design';
import { useAppTheme } from '@/theme/app-theme';

interface PolicySectionProps {
  title: string;
  children: string;
}

function PolicySection({ title, children }: PolicySectionProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" variant="h3">
        {title}
      </AppText>
      <AppText color={colors.inkSoft}>{children}</AppText>
    </View>
  );
}

export default function LegalScreen() {
  const { colors } = useAppTheme();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ContentShell maxWidth={760} style={styles.shell}>
        <View style={styles.topbar}>
          <IconButton
            accessibilityLabel="Go back"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
          <AppText color={colors.muted} variant="micro">PRODUCT POLICIES</AppText>
        </View>

        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.wineSoft }]}>
            <FileCheck2 color={colors.wine} size={28} strokeWidth={2} />
          </View>
          <View style={styles.heroCopy}>
            <AppText accessibilityRole="header" variant="h1">Terms &amp; privacy</AppText>
            <AppText color={colors.muted}>Last updated 26 August 2026</AppText>
          </View>
        </View>

        <Surface padding="lg" tone="inset" style={styles.reviewNote}>
          <ShieldCheck color={colors.wine} size={21} strokeWidth={2} />
          <AppText color={colors.inkSoft} style={styles.flexText} variant="support">
            These are StrathFind product terms, not legal advice. The deployment owner should obtain Kenyan legal review, including data-protection review, before launch.
          </AppText>
        </Surface>

        <AppText color={colors.inkSoft}>
          By creating an account or using StrathFind, you agree to these terms and acknowledge the privacy notice below.
        </AppText>

        <Surface padding="xl" style={styles.policyCard}>
          <View style={[styles.cardHeading, { borderBottomColor: colors.lineSoft }]}>
            <AppText color={colors.wine} variant="micro">TERMS OF USE</AppText>
            <AppText accessibilityRole="header" variant="h2">Use StrathFind responsibly</AppText>
          </View>

          <PolicySection title="1. Campus use and eligibility">
            StrathFind is for eligible members of the participating campus community. You must provide accurate account details and use the service only to report, identify, claim, or return property connected to that campus.
          </PolicySection>

          <PolicySection title="2. Reports and photos">
            Only post truthful, relevant information. You keep ownership of your text and photos, and grant StrathFind a limited licence to store, display, resize, and moderate them only to operate and improve the service. Do not upload content you do not have permission to use.
          </PolicySection>

          <PolicySection title="3. Prohibited conduct">
            Do not make false claims, impersonate another person, harass users, trade stolen property, expose private information, bypass access controls, scrape the service, upload harmful code, or use StrathFind for unlawful or commercial activity.
          </PolicySection>

          <PolicySection title="4. Privacy during a match">
            Share only the location detail needed to identify an item. Do not post home addresses, identity documents, passwords, access codes, or another person’s contact details. Contact details and precise handoff information should be revealed only when needed for a verified return.
          </PolicySection>

          <PolicySection title="5. Claims, verification, and handoffs">
            A listing is not proof of ownership. Claimants may be asked for non-public identifying details. Use a staffed campus handoff point, keep valuables in view, and involve campus security if a handoff feels unsafe. Never meet alone in an isolated place.
          </PolicySection>

          <PolicySection title="6. No guarantee">
            StrathFind helps people connect; it does not hold, insure, authenticate, or guarantee the return or condition of any item. Users remain responsible for reports, claims, messages, and handoffs. Contact campus security or emergency services where theft, danger, or urgent risk is involved.
          </PolicySection>

          <PolicySection title="7. Moderation">
            We may review, hide, preserve, or remove content, limit features, suspend accounts, and cooperate with campus authorities or lawful requests where reasonably necessary for safety, integrity, or compliance. Reports are assessed, but immediate action is not guaranteed.
          </PolicySection>

          <PolicySection title="8. Account security">
            Keep your sign-in credentials private, use a strong unique password, and promptly report suspected account misuse. You are responsible for activity under your account unless applicable law provides otherwise.
          </PolicySection>

          <PolicySection title="9. Liability">
            To the extent permitted by law, StrathFind and its operator are not liable for indirect or consequential loss arising from user conduct, missing property, inaccurate reports, or unavailable service. Nothing here excludes statutory rights or liability that cannot legally be excluded.
          </PolicySection>

          <PolicySection title="10. Changes and contact">
            These terms may change as the service evolves. Material changes should be shown in the app before they take effect. Use Help in Settings for questions or complaints. The deployment owner must publish valid support and privacy contact details before launch.
          </PolicySection>
        </Surface>

        <Surface padding="xl" style={styles.policyCard}>
          <View style={[styles.cardHeading, { borderBottomColor: colors.lineSoft }]}>
            <AppText color={colors.wine} variant="micro">PRIVACY NOTICE</AppText>
            <AppText accessibilityRole="header" variant="h2">How information is handled</AppText>
          </View>

          <PolicySection title="Information collected">
            Account and campus-verification details; report text, photos, categories, dates, and locations; claims and handoff records; moderation or support messages; and basic device, security, and service-usage logs. Avoid including sensitive personal data in reports.
          </PolicySection>

          <PolicySection title="How it is used">
            Information is used to operate accounts, publish lost-and-found reports, suggest possible matches, support safer claims and handoffs, prevent abuse, respond to support requests, maintain the service, and meet legal obligations.
          </PolicySection>

          <PolicySection title="Visibility and sharing">
            Listing photos and general report details may be visible to people browsing the service. Account contact details and sensitive claim information should remain restricted. Information may be shared with service providers, campus authorities for safety or verification, or authorities where legally required. It is not sold for advertising.
          </PolicySection>

          <PolicySection title="Storage, security, and retention">
            Reasonable technical and organisational safeguards should be used, but no online service is risk-free. Records should be kept only as long as needed for active reports, safety, dispute handling, legal duties, or legitimate service operations, then deleted or anonymised under the operator’s retention schedule.
          </PolicySection>

          <PolicySection title="Your choices and rights">
            Depending on applicable law, you may ask to access, correct, delete, restrict, or object to certain processing of your personal data, and may withdraw consent where consent is the basis. You may also complain to the relevant data-protection authority. Some records may be retained where law or safety requires it.
          </PolicySection>

          <PolicySection title="Account closure">
            You may request account closure through Settings or the published privacy contact. Closing an account does not automatically remove information that must be retained for an unresolved claim, safety investigation, fraud prevention, or legal obligation.
          </PolicySection>
        </Surface>

        <AppText align="center" color={colors.muted} style={styles.footer} variant="support">
          Safer reports. Private details. Public handoffs.
        </AppText>
      </ContentShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.xl,
    paddingBottom: spacing.section,
  },
  topbar: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  reviewNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  flexText: {
    flex: 1,
  },
  policyCard: {
    gap: spacing.xl,
  },
  cardHeading: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  section: {
    gap: spacing.xs,
  },
  footer: {
    paddingTop: spacing.sm,
  },
});
