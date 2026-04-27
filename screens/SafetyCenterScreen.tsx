import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import InfoRow from '../components/ui/InfoRow';
import { colors, spacing } from '../theme';

type NavigationProp = StackNavigationProp<any>;

function SectionLabel({ title }: { title: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelText}>{title}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const FAQ_ITEMS = [
  {
    q: 'What is a Designated Driver (DD)?',
    a: 'A DD is a sober chapter member who volunteers to drive others home from events. They must pass a Sobriety Evaluation Process (SEP) before going on duty.',
  },
  {
    q: 'What is the SEP?',
    a: 'The Sobriety Evaluation Process measures your baseline reaction time and voice pattern during onboarding. Before each DD shift, you repeat the test — results outside tolerance prevent you from driving.',
  },
  {
    q: 'What happens if a DD fails the SEP?',
    a: 'Their DD status is immediately revoked for that event. An admin is alerted and must manually reinstate them after review.',
  },
  {
    q: 'How do I request a ride?',
    a: 'Go to Find DD, select an event, tap a driver, and tap "Request Ride." The DD will see your request in their queue.',
  },
  {
    q: 'Can I cancel a ride request?',
    a: 'Yes — go to Rides and tap "Cancel Request" as long as the DD hasn\'t already accepted.',
  },
];

function FAQSection() {
  const [expanded, setExpanded] = React.useState<number | null>(null);

  return (
    <View style={styles.section}>
      {FAQ_ITEMS.map((item, i) => (
        <React.Fragment key={i}>
          <View>
            <TouchableOpacity
              style={styles.faqRow}
              onPress={() => setExpanded(expanded === i ? null : i)}
              activeOpacity={0.7}
            >
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <Ionicons
                name={expanded === i ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
            {expanded === i && (
              <Text style={styles.faqAnswer}>{item.a}</Text>
            )}
          </View>
          {i < FAQ_ITEMS.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function SafetyCenterScreen() {
  const navigation = useNavigation<NavigationProp>();

  const callEmergency = () => {
    Alert.alert('Call 911', 'You are about to call emergency services.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call 911', style: 'destructive', onPress: () => Linking.openURL('tel:911') },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={32} color={colors.brand.primary} />
        </View>
        <Text style={styles.heroTitle}>Help & Safety</Text>
        <Text style={styles.heroSubtitle}>
          DSober is built around keeping everyone safe. Use these resources any time you need help.
        </Text>
      </View>

      {/* Emergency */}
      <SectionLabel title="Emergency" />
      <View style={styles.section}>
        <InfoRow
          icon="call"
          label="Call 911"
          subtitle="Police, fire, or medical emergency"
          onPress={callEmergency}
          iconColor={colors.ui.error}
        />
        <Divider />
        <InfoRow
          icon="people"
          label="Contact Chapter Advisor"
          subtitle="Reach your chapter's point of contact"
          onPress={() => Linking.openURL('tel:')}
          iconColor={colors.ui.warning}
        />
      </View>

      {/* Report */}
      <SectionLabel title="Report a Problem" />
      <View style={styles.section}>
        <InfoRow
          icon="warning-outline"
          label="Report a Ride Issue"
          subtitle="DD behavior, no-show, or unsafe situation"
          onPress={() => navigation.navigate('ReportIssue', { type: 'ride' })}
        />
        <Divider />
        <InfoRow
          icon="alert-circle-outline"
          label="Report a Safety Concern"
          subtitle="Something felt unsafe at an event"
          onPress={() => navigation.navigate('ReportIssue', { type: 'safety' })}
        />
        <Divider />
        <InfoRow
          icon="bug-outline"
          label="Report an App Issue"
          subtitle="Something is broken or not working"
          onPress={() => navigation.navigate('ReportIssue', { type: 'bug' })}
        />
      </View>

      {/* How it works */}
      <SectionLabel title="Frequently Asked Questions" />
      <FAQSection />

      {/* Contact */}
      <SectionLabel title="Contact" />
      <View style={styles.section}>
        <InfoRow
          icon="mail-outline"
          label="Email Support"
          subtitle="support@dsober.app"
          onPress={() => Linking.openURL('mailto:support@dsober.app?subject=DSober Support')}
        />
      </View>

      <Text style={styles.footer}>
        DSober is a safety tool, not a substitute for emergency services. In any life-threatening situation, call 911 immediately.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  content: {
    paddingBottom: 48,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Section
  sectionLabel: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  section: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 16 + 32 + 12,
  },

  // FAQ
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    lineHeight: 21,
  },
  faqAnswer: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },

  // Footer
  footer: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
