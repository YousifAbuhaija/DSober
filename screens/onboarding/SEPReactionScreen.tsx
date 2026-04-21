import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import StepProgress from '../../components/ui/StepProgress';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { colors, spacing, typography, radii } from '../../theme';

type RouteParams = { mode?: 'baseline' | 'attempt'; eventId?: string };
type TrialState = 'waiting' | 'ready' | 'go' | 'tapped' | 'early';

const TOTAL_TRIALS = 5;
const MIN_DELAY = 1000;
const MAX_DELAY = 3000;

const BG: Record<TrialState, string> = {
  waiting: colors.bg.canvas,
  ready:   `${colors.ui.warning}22`,
  go:      `${colors.ui.success}22`,
  tapped:  colors.bg.canvas,
  early:   `${colors.ui.error}22`,
};

const LABEL: Record<TrialState, string> = {
  waiting: 'Tap to begin',
  ready:   'Wait…',
  go:      'GO!',
  tapped:  '',
  early:   'Too early!',
};

const LABEL_COLOR: Record<TrialState, string> = {
  waiting: colors.text.tertiary,
  ready:   colors.ui.warning,
  go:      colors.ui.success,
  tapped:  colors.text.primary,
  early:   colors.ui.error,
};

export default function SEPReactionScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const mode = route.params?.mode ?? 'baseline';
  const eventId = route.params?.eventId;

  const [showInstructions, setShowInstructions] = useState(true);
  const [trial, setTrial] = useState(0);
  const [trialState, setTrialState] = useState<TrialState>('waiting');
  const [times, setTimes] = useState<number[]>([]);
  const [lastTime, setLastTime] = useState<number | null>(null);

  const goTimeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const startTrial = () => {
    setTrialState('ready');
    const delay = Math.random() * (MAX_DELAY - MIN_DELAY) + MIN_DELAY;
    timeoutRef.current = setTimeout(() => {
      setTrialState('go');
      goTimeRef.current = Date.now();
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }, delay);
  };

  const handleTap = () => {
    if (trialState === 'tapped') return;

    if (trialState === 'waiting') { startTrial(); return; }

    if (trialState === 'ready') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setTrialState('early');
      setTimeout(() => setTrialState('waiting'), 1200);
      return;
    }

    if (trialState === 'go') {
      const rt = Date.now() - goTimeRef.current;
      const next = [...times, rt];
      setTimes(next);
      setLastTime(rt);
      setTrialState('tapped');
      setTimeout(() => {
        if (trial + 1 < TOTAL_TRIALS) {
          setTrial((t) => t + 1);
          setTrialState('waiting');
          setLastTime(null);
        } else {
          finish(next);
        }
      }, 900);
    }
  };

  const finish = (allTimes: number[]) => {
    const avg = Math.round(allTimes.reduce((s, t) => s + t, 0) / allTimes.length);
    const params = mode === 'baseline'
      ? { mode: 'baseline', reactionAvgMs: avg }
      : { mode: 'attempt', eventId, reactionAvgMs: avg };
    navigation.navigate('SEPPhrase', params);
  };

  if (showInstructions) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.instructionsPage}>
          <StepProgress current={0} total={3} label="Reaction Test" />

          <View style={styles.instructionsBody}>
            <Text style={styles.instructionsTitle}>Reaction Time Test</Text>
            <Text style={styles.instructionsSub}>
              {mode === 'baseline'
                ? 'We establish your personal baseline so future checks can be compared to it.'
                : 'Your reaction speed is measured against your stored baseline.'}
            </Text>

            <Card style={styles.howCard}>
              {[
                'Wait for the screen to flash green',
                'Tap immediately when you see GO!',
                'Don\'t tap during the yellow "Wait" phase',
                'Complete 5 trials total',
              ].map((step, i) => (
                <View key={i} style={styles.howRow}>
                  <View style={styles.howNum}>
                    <Text style={styles.howNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.howText}>{step}</Text>
                </View>
              ))}
            </Card>
          </View>

          <Button
            onPress={() => setShowInstructions(false)}
            label="Begin Test"
            fullWidth
            size="lg"
            style={styles.beginBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  const bg = BG[trialState];
  const labelColor = LABEL_COLOR[trialState];

  return (
    <TouchableOpacity
      style={[styles.testContainer, { backgroundColor: bg }]}
      activeOpacity={1}
      onPress={handleTap}
    >
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_TRIALS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.trialDot,
                i < trial ? styles.trialDotDone : i === trial ? styles.trialDotActive : styles.trialDotPending,
              ]}
            />
          ))}
        </View>

        {/* Center signal */}
        <View style={styles.signalArea}>
          {trialState === 'go' ? (
            <Animated.Text style={[styles.goText, { transform: [{ scale: scaleAnim }] }]}>
              GO!
            </Animated.Text>
          ) : trialState === 'tapped' && lastTime !== null ? (
            <View style={styles.timeResult}>
              <Text style={styles.timeValue}>{lastTime}</Text>
              <Text style={styles.timeUnit}>ms</Text>
              {times.length > 1 && (
                <Text style={styles.avgText}>
                  avg {Math.round(times.reduce((s, t) => s + t, 0) / times.length)}ms
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.signalLabel, { color: labelColor }]}>
              {LABEL[trialState]}
            </Text>
          )}
        </View>

        <Text style={styles.trialCount}>Trial {trial + 1} / {TOTAL_TRIALS}</Text>
      </SafeAreaView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  fill: { flex: 1 },
  instructionsPage: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  instructionsBody: {
    flex: 1,
    justifyContent: 'center',
  },
  instructionsTitle: {
    ...typography.title1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  instructionsSub: {
    ...typography.callout,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  howCard: {
    gap: spacing.md,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  howNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '700',
  },
  howText: {
    ...typography.callout,
    color: colors.text.secondary,
    flex: 1,
  },
  beginBtn: { marginTop: 'auto' as any },
  testContainer: { flex: 1 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing['2xl'],
  },
  trialDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  trialDotDone:    { backgroundColor: colors.ui.success },
  trialDotActive:  { backgroundColor: colors.text.primary },
  trialDotPending: { backgroundColor: colors.border.subtle },
  signalArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goText: {
    fontSize: 88,
    fontWeight: '800',
    color: colors.ui.success,
    letterSpacing: -2,
  },
  signalLabel: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeResult: { alignItems: 'center' },
  timeValue: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.text.primary,
    lineHeight: 80,
  },
  timeUnit: {
    ...typography.title3,
    color: colors.text.tertiary,
  },
  avgText: {
    ...typography.callout,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  trialCount: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingBottom: spacing['2xl'],
  },
});
