import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../../lib/supabase';
import { evaluateSEPAttempt } from '../../utils/sep';
import { SEPBaseline } from '../../types/database.types';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import StatusPill from '../../components/ui/StatusPill';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../../theme';

type RouteParams = {
  eventId: string;
  reactionAvgMs: number;
  phraseDurationSec: number;
  selfieUrl: string;
};

type Evaluation = {
  pass: boolean;
  reactionOk: boolean;
  phraseOk: boolean;
  reactionDiff: number;
  phraseDiff: number;
  baseline: SEPBaseline;
};

export default function SEPResultScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { eventId, reactionAvgMs, phraseDurationSec, selfieUrl } = route.params ?? {};

  const [evaluating, setEvaluating] = useState(true);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { evaluate(); }, []);

  const evaluate = async () => {
    setEvaluating(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: raw, error: bErr } = await supabase
        .from('sep_baselines').select('*').eq('user_id', user.id).single();
      if (bErr || !raw) throw new Error('Baseline not found. Complete onboarding first.');

      const baseline: SEPBaseline = {
        id: raw.id, userId: raw.user_id, reactionAvgMs: raw.reaction_avg_ms,
        phraseDurationSec: raw.phrase_duration_sec, selfieUrl: raw.selfie_url,
        createdAt: new Date(raw.created_at),
      };

      const evaluation = evaluateSEPAttempt(baseline, { reactionAvgMs, phraseDurationSec });

      const { data: attemptRow } = await supabase
        .from('sep_attempts').insert({
          user_id: user.id, event_id: eventId,
          reaction_avg_ms: reactionAvgMs, phrase_duration_sec: phraseDurationSec,
          selfie_url: selfieUrl, result: evaluation.pass ? 'pass' : 'fail',
        }).select().single();

      if (evaluation.pass) {
        await supabase.from('dd_sessions').insert({
          user_id: user.id, event_id: eventId,
          started_at: new Date().toISOString(), is_active: true,
        });
      } else {
        await Promise.all([
          supabase.from('users').update({ dd_status: 'revoked' }).eq('id', user.id),
          supabase.from('dd_assignments').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('user_id', user.id),
          supabase.from('dd_requests').update({ status: 'rejected' }).eq('user_id', user.id).in('status', ['pending', 'approved']),
          supabase.from('dd_sessions').update({ ended_at: new Date().toISOString(), is_active: false }).eq('user_id', user.id).eq('is_active', true),
        ]);
        if (attemptRow) {
          await supabase.from('admin_alerts').insert({
            type: 'SEP_FAIL', user_id: user.id, event_id: eventId, sep_attempt_id: attemptRow.id,
          });
        }
      }

      setResult({ ...evaluation, baseline });
    } catch (err: any) {
      setError(err?.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  if (evaluating) return <LoadingScreen message="Evaluating your results…" />;

  if (error || !result) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorPage}>
          <Ionicons name="warning-outline" size={48} color={colors.ui.warning} />
          <Text style={styles.errorTitle}>Evaluation Error</Text>
          <Text style={styles.errorBody}>{error ?? 'Unknown error'}</Text>
          <Button onPress={evaluate} label="Try Again" fullWidth style={styles.errorBtn} />
          <Button variant="ghost" onPress={() => navigation.goBack()} label="Go Back" fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  const passBg  = result.pass ? '#0A2010' : '#2A0A0A';
  const passAccent = result.pass ? colors.ui.success : colors.ui.error;

  const metrics = [
    {
      name: 'Reaction Time',
      ok: result.reactionOk,
      baseline: `${result.baseline.reactionAvgMs}ms`,
      current: `${reactionAvgMs}ms`,
      diff: `+${result.reactionDiff.toFixed(0)}ms`,
      tolerance: '±150ms',
    },
    {
      name: 'Phrase Duration',
      ok: result.phraseOk,
      baseline: `${result.baseline.phraseDurationSec.toFixed(2)}s`,
      current: `${phraseDurationSec.toFixed(2)}s`,
      diff: `+${result.phraseDiff.toFixed(2)}s`,
      tolerance: '±2.0s',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Result hero */}
        <View style={[styles.hero, { backgroundColor: passBg, borderColor: passAccent }]}>
          <Ionicons
            name={result.pass ? 'checkmark-circle' : 'close-circle'}
            size={64}
            color={passAccent}
          />
          <Text style={[styles.heroTitle, { color: passAccent }]}>
            {result.pass ? 'Verification Passed' : 'Verification Failed'}
          </Text>
          <Text style={styles.heroSub}>
            {result.pass
              ? 'You are cleared to begin your DD session.'
              : 'An admin has been notified and will review your status.'}
          </Text>
        </View>

        {/* Metric cards */}
        <Text style={styles.sectionLabel}>TEST RESULTS</Text>
        {metrics.map((m) => (
          <Card key={m.name} style={styles.metricCard} elevated>
            <View style={styles.metricHeader}>
              <Text style={styles.metricName}>{m.name}</Text>
              <StatusPill status={m.ok ? 'pass' : 'fail'} />
            </View>
            <View style={styles.metricRows}>
              {[
                { label: 'Baseline', val: m.baseline },
                { label: 'Current', val: m.current },
                { label: 'Difference', val: m.diff, color: m.ok ? colors.ui.success : colors.ui.error },
              ].map(({ label, val, color }) => (
                <View key={label} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{label}</Text>
                  <Text style={[styles.metricVal, color ? { color } : null]}>{val}</Text>
                </View>
              ))}
              <Text style={styles.tolerance}>Tolerance: {m.tolerance}</Text>
            </View>
          </Card>
        ))}

        {!result.pass && (
          <Card style={styles.warningCard}>
            <View style={styles.warningRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.ui.warning} />
              <Text style={styles.warningText}>
                Your DD assignment has been temporarily revoked. An admin will review and may reinstate you.
              </Text>
            </View>
          </Card>
        )}

        {/* CTA */}
        <Button
          onPress={() => {
            if (result.pass) navigation.navigate('DDActiveSession', { eventId });
            else navigation.navigate('EventDetail', { eventId });
          }}
          label={result.pass ? 'Start DD Session' : 'Back to Event'}
          variant={result.pass ? 'success' : 'secondary'}
          fullWidth
          size="lg"
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  scroll: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1.5,
    padding: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  heroTitle: { ...typography.title2, textAlign: 'center' },
  heroSub: { ...typography.callout, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  sectionLabel: { ...typography.label, color: colors.text.tertiary, marginBottom: spacing.md },
  metricCard: { marginBottom: spacing.md },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  metricName: { ...typography.bodyBold, color: colors.text.primary },
  metricRows: { gap: spacing.sm },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { ...typography.callout, color: colors.text.secondary },
  metricVal: { ...typography.bodyBold, color: colors.text.primary },
  tolerance: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xs },
  warningCard: { marginBottom: spacing.xl, borderLeftWidth: 3, borderLeftColor: colors.ui.warning },
  warningRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  warningText: { ...typography.callout, color: colors.text.secondary, flex: 1, lineHeight: 22 },
  cta: {},
  // Error page
  errorPage: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.base,
  },
  errorTitle: { ...typography.title2, color: colors.text.primary, textAlign: 'center' },
  errorBody: { ...typography.callout, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  errorBtn: { marginTop: spacing.base },
});
