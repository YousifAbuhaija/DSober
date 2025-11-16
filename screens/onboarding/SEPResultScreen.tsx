import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../../lib/supabase';
import { evaluateSEPAttempt } from '../../utils/sep';
import { SEPBaseline } from '../../types/database.types';
import { theme } from '../../theme/colors';

type SEPResultRouteParams = {
  eventId: string;
  reactionAvgMs: number;
  phraseDurationSec: number;
  selfieUrl: string;
};

export default function SEPResultScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: SEPResultRouteParams }, 'params'>>();
  const { eventId, reactionAvgMs, phraseDurationSec, selfieUrl } = route.params || {};

  const [isEvaluating, setIsEvaluating] = useState(true);
  const [result, setResult] = useState<{
    pass: boolean;
    reactionOk: boolean;
    phraseOk: boolean;
    reactionDiff: number;
    phraseDiff: number;
    baseline: SEPBaseline;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate required params
    console.log('SEPResultScreen params:', { eventId, reactionAvgMs, phraseDurationSec, selfieUrl });
    
    if (!eventId || reactionAvgMs === undefined || phraseDurationSec === undefined || !selfieUrl) {
      setError('Missing required data. Please complete all SEP tests.');
      setIsEvaluating(false);
      return;
    }
    
    evaluateAttempt();
  }, []);

  const evaluateAttempt = async () => {
    try {
      setIsEvaluating(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch user's SEP baseline
      const { data: baselineData, error: baselineError } = await supabase
        .from('sep_baselines')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (baselineError || !baselineData) {
        throw new Error('SEP baseline not found. Please complete onboarding first.');
      }

      // Transform snake_case to camelCase
      const baseline: SEPBaseline = {
        id: baselineData.id,
        userId: baselineData.user_id,
        reactionAvgMs: baselineData.reaction_avg_ms,
        phraseDurationSec: baselineData.phrase_duration_sec,
        selfieUrl: baselineData.selfie_url,
        createdAt: new Date(baselineData.created_at),
      };

      console.log('Baseline data:', baseline);

      // Evaluate the attempt
      const evaluation = evaluateSEPAttempt(baseline, {
        reactionAvgMs,
        phraseDurationSec,
      });

      // Create SEPAttempt record
      const { data: attemptData, error: attemptError } = await supabase
        .from('sep_attempts')
        .insert({
          user_id: user.id,
          event_id: eventId,
          reaction_avg_ms: reactionAvgMs,
          phrase_duration_sec: phraseDurationSec,
          selfie_url: selfieUrl,
          result: evaluation.pass ? 'pass' : 'fail',
        })
        .select()
        .single();

      if (attemptError) {
        throw attemptError;
      }

      if (evaluation.pass) {
        // SEP passed - create DD session
        const { error: sessionError } = await supabase
          .from('dd_sessions')
          .insert({
            user_id: user.id,
            event_id: eventId,
            started_at: new Date().toISOString(),
            is_active: true,
          });

        if (sessionError) {
          throw sessionError;
        }
      } else {
        // SEP failed - globally revoke DD status
        console.log('SEP failed - globally revoking DD status for user:', user.id);
        
        // 1. Update user's dd_status to 'revoked'
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ dd_status: 'revoked' })
          .eq('id', user.id);

        if (userUpdateError) {
          console.error('Error updating user dd_status:', userUpdateError);
        } else {
          console.log('User dd_status updated to revoked');
        }

        // 2. Revoke ALL DD assignments for this user (not just this event)
        const { data: allAssignments, error: assignmentError } = await supabase
          .from('dd_assignments')
          .update({ status: 'revoked', updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select();

        if (assignmentError) {
          console.error('Error revoking all assignments:', assignmentError);
        } else {
          console.log('All assignments revoked:', allAssignments?.length || 0, 'assignments');
        }

        // 3. Reject ALL pending and approved DD requests for this user
        const { data: rejectedRequests, error: requestsError } = await supabase
          .from('dd_requests')
          .update({ status: 'rejected' })
          .eq('user_id', user.id)
          .in('status', ['pending', 'approved'])
          .select();

        if (requestsError) {
          console.error('Error rejecting requests:', requestsError);
        } else {
          console.log('Requests rejected:', rejectedRequests?.length || 0, 'requests');
        }

        // 4. End ALL active DD sessions for this user
        const { data: endedSessions, error: sessionsError } = await supabase
          .from('dd_sessions')
          .update({ 
            ended_at: new Date().toISOString(),
            is_active: false 
          })
          .eq('user_id', user.id)
          .eq('is_active', true)
          .select();

        if (sessionsError) {
          console.error('Error ending active sessions:', sessionsError);
        } else {
          console.log('Active sessions ended:', endedSessions?.length || 0, 'sessions');
        }

        // 5. Create admin alert for the specific event where they failed
        const { error: alertError } = await supabase
          .from('admin_alerts')
          .insert({
            type: 'SEP_FAIL',
            user_id: user.id,
            event_id: eventId,
            sep_attempt_id: attemptData.id,
          });

        if (alertError) {
          console.error('Error creating admin alert:', alertError);
        }
      }

      // Set result state
      setResult({
        ...evaluation,
        baseline,
      });
    } catch (err: any) {
      console.error('Error evaluating SEP attempt:', err);
      setError(err.message || 'Failed to evaluate SEP attempt');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleContinue = () => {
    if (result?.pass) {
      // Navigate to active DD session screen
      navigation.navigate('DDActiveSession', { eventId });
    } else {
      // Navigate back to event detail screen
      navigation.navigate('EventDetail', { eventId });
    }
  };

  if (isEvaluating) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Evaluating your SEP attempt...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Evaluation Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={evaluateAttempt}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        {/* Result Header */}
        <View style={[
          styles.resultHeader,
          result.pass ? styles.resultHeaderPass : styles.resultHeaderFail
        ]}>
          <Text style={styles.resultIcon}>{result.pass ? '✓' : '✗'}</Text>
          <Text style={styles.resultTitle}>
            {result.pass ? 'SEP Verification Passed' : 'SEP Verification Failed'}
          </Text>
          <Text style={styles.resultSubtitle}>
            {result.pass
              ? 'You are cleared to start your DD session'
              : 'An admin has been notified and will review your status'}
          </Text>
        </View>

        {/* Metrics Comparison */}
        <View style={styles.metricsContainer}>
          <Text style={styles.metricsTitle}>Test Results</Text>

          {/* Reaction Time */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricName}>Reaction Time</Text>
              <View style={[
                styles.metricBadge,
                result.reactionOk ? styles.metricBadgePass : styles.metricBadgeFail
              ]}>
                <Text style={styles.metricBadgeText}>
                  {result.reactionOk ? 'PASS' : 'FAIL'}
                </Text>
              </View>
            </View>
            <View style={styles.metricDetails}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Baseline:</Text>
                <Text style={styles.metricValue}>{result.baseline.reactionAvgMs}ms</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Current:</Text>
                <Text style={styles.metricValue}>{reactionAvgMs}ms</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Difference:</Text>
                <Text style={[
                  styles.metricValue,
                  result.reactionOk ? styles.metricValueGood : styles.metricValueBad
                ]}>
                  +{result.reactionDiff.toFixed(0)}ms
                </Text>
              </View>
              <Text style={styles.metricThreshold}>
                Tolerance: +150ms
              </Text>
            </View>
          </View>

          {/* Phrase Duration */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricName}>Phrase Duration</Text>
              <View style={[
                styles.metricBadge,
                result.phraseOk ? styles.metricBadgePass : styles.metricBadgeFail
              ]}>
                <Text style={styles.metricBadgeText}>
                  {result.phraseOk ? 'PASS' : 'FAIL'}
                </Text>
              </View>
            </View>
            <View style={styles.metricDetails}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Baseline:</Text>
                <Text style={styles.metricValue}>
                  {result.baseline.phraseDurationSec.toFixed(2)}s
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Current:</Text>
                <Text style={styles.metricValue}>
                  {phraseDurationSec !== undefined ? phraseDurationSec.toFixed(2) : 'N/A'}s
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Difference:</Text>
                <Text style={[
                  styles.metricValue,
                  result.phraseOk ? styles.metricValueGood : styles.metricValueBad
                ]}>
                  +{result.phraseDiff.toFixed(2)}s
                </Text>
              </View>
              <Text style={styles.metricThreshold}>
                Tolerance: +2.0s
              </Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            result.pass ? styles.continueButtonPass : styles.continueButtonFail
          ]}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>
            {result.pass ? 'Start DD Session' : 'Back to Event'}
          </Text>
        </TouchableOpacity>

        {/* Additional Info */}
        {!result.pass && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Your DD assignment has been temporarily revoked. An admin will review your
              SEP results and may reinstate you if appropriate.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  retryButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 12,
  },
  backButtonText: {
    color: theme.colors.primary.main,
    fontSize: 16,
  },
  resultHeader: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  resultHeaderPass: {
    backgroundColor: theme.colors.background.elevated,
    borderWidth: 2,
    borderColor: theme.colors.functional.success,
  },
  resultHeaderFail: {
    backgroundColor: theme.colors.background.elevated,
    borderWidth: 2,
    borderColor: theme.colors.functional.error,
  },
  resultIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  resultSubtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  metricsContainer: {
    marginBottom: 24,
  },
  metricsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  metricCard: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  metricBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metricBadgePass: {
    backgroundColor: theme.colors.functional.success,
  },
  metricBadgeFail: {
    backgroundColor: theme.colors.functional.error,
  },
  metricBadgeText: {
    color: theme.colors.text.onPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricDetails: {
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  metricValueGood: {
    color: theme.colors.functional.success,
  },
  metricValueBad: {
    color: theme.colors.functional.error,
  },
  metricThreshold: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  continueButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  continueButtonPass: {
    backgroundColor: theme.colors.functional.success,
  },
  continueButtonFail: {
    backgroundColor: theme.colors.primary.main,
  },
  continueButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.functional.warning,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
});
