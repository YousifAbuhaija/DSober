import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '../../theme/colors';

type SEPReactionRouteParams = {
  mode?: 'baseline' | 'attempt';
  eventId?: string;
};

type TrialState = 'waiting' | 'ready' | 'go' | 'tapped' | 'early';

export default function SEPReactionScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: SEPReactionRouteParams }, 'params'>>();
  const mode = route.params?.mode || 'baseline';
  const eventId = route.params?.eventId;
  
  const TOTAL_TRIALS = 5;
  const MIN_DELAY_MS = 1000;
  const MAX_DELAY_MS = 3000;
  
  const [currentTrial, setCurrentTrial] = useState(0);
  const [trialState, setTrialState] = useState<TrialState>('waiting');
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  
  const goTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      // Cleanup timeout on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startTrial = () => {
    setTrialState('ready');
    
    // Random delay before showing "GO"
    const delay = Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS;
    
    timeoutRef.current = setTimeout(() => {
      setTrialState('go');
      goTimeRef.current = Date.now();
      
      // Animate the GO signal
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
  };

  const handleTap = () => {
    if (trialState === 'tapped') {
      return;
    }

    if (trialState === 'waiting') {
      // Start the next trial
      startTrial();
      return;
    }

    if (trialState === 'ready') {
      // User tapped too early
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setTrialState('early');
      
      setTimeout(() => {
        setTrialState('waiting');
      }, 1500);
      return;
    }

    if (trialState === 'go') {
      // Calculate reaction time
      const reactionTime = Date.now() - goTimeRef.current;
      const newReactionTimes = [...reactionTimes, reactionTime];
      setReactionTimes(newReactionTimes);
      setTrialState('tapped');
      
      // Move to next trial or finish
      setTimeout(() => {
        if (currentTrial + 1 < TOTAL_TRIALS) {
          setCurrentTrial(currentTrial + 1);
          setTrialState('waiting');
        } else {
          // All trials complete
          finishTest(newReactionTimes);
        }
      }, 1000);
    }
  };

  const finishTest = (times: number[]) => {
    // Calculate average reaction time
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const roundedAverage = Math.round(average);
    
    console.log('SEPReactionScreen finishTest:', {
      times,
      average,
      roundedAverage,
      mode,
      eventId,
    });
    
    // Navigate to next screen with reaction time data
    if (mode === 'baseline') {
      navigation.navigate('SEPPhrase', {
        mode: 'baseline',
        reactionAvgMs: roundedAverage,
      });
    } else {
      navigation.navigate('SEPPhrase', {
        mode: 'attempt',
        eventId,
        reactionAvgMs: roundedAverage,
      });
    }
  };

  const handleStart = () => {
    setShowInstructions(false);
    startTrial();
  };

  if (showInstructions) {
    return (
      <View style={styles.container}>
        <View style={styles.instructionsContainer}>
          <Text style={styles.title}>Reaction Time Test</Text>
          <Text style={styles.subtitle}>
            {mode === 'baseline' 
              ? 'Let\'s establish your baseline reaction time'
              : 'Test your current reaction time'}
          </Text>
          
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>How it works:</Text>
            <Text style={styles.instructionsText}>
              1. Wait for the screen to turn blue{'\n'}
              2. When you see "GO!", tap the screen as fast as you can{'\n'}
              3. Complete {TOTAL_TRIALS} trials{'\n'}
              4. Don't tap too early or you'll have to retry!
            </Text>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Start Test</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        trialState === 'ready' && styles.containerReady,
        trialState === 'go' && styles.containerGo,
        trialState === 'early' && styles.containerEarly,
      ]}
      activeOpacity={1}
      onPress={handleTap}
    >
      <View style={styles.content}>
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Trial {currentTrial + 1} of {TOTAL_TRIALS}
          </Text>
          <View style={styles.progressBar}>
            {Array.from({ length: TOTAL_TRIALS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < currentTrial && styles.progressDotComplete,
                  index === currentTrial && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Main instruction area */}
        <View style={styles.instructionArea}>
          {trialState === 'waiting' && (
            <Text style={styles.instructionText}>Tap to start trial</Text>
          )}
          
          {trialState === 'ready' && (
            <Text style={styles.instructionText}>Wait for it...</Text>
          )}
          
          {trialState === 'go' && (
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Text style={styles.goText}>GO!</Text>
            </Animated.View>
          )}
          
          {trialState === 'tapped' && reactionTimes.length > 0 && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>
                {reactionTimes[reactionTimes.length - 1]}ms
              </Text>
              <Text style={styles.resultLabel}>Reaction Time</Text>
            </View>
          )}
          
          {trialState === 'early' && (
            <View style={styles.earlyContainer}>
              <Text style={styles.earlyText}>Too Early!</Text>
              <Text style={styles.earlySubtext}>Wait for the GO signal</Text>
            </View>
          )}
        </View>

        {/* Reaction times history */}
        {reactionTimes.length > 0 && trialState !== 'tapped' && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Previous Times:</Text>
            <View style={styles.historyList}>
              {reactionTimes.map((time, index) => (
                <Text key={index} style={styles.historyItem}>
                  {time}ms
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  containerReady: {
    backgroundColor: '#FFF9E6', // Preserved functional yellow tint
  },
  containerGo: {
    backgroundColor: '#4CAF50', // Preserved functional green
  },
  containerEarly: {
    backgroundColor: '#FF5252', // Preserved functional red
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  instructionsContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  instructionsBox: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  progressText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 12,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.border.default,
  },
  progressDotComplete: {
    backgroundColor: theme.colors.functional.success,
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary.main,
  },
  instructionArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 24,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  goText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  resultContainer: {
    alignItems: 'center',
  },
  resultText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.functional.success,
  },
  resultLabel: {
    fontSize: 18,
    color: theme.colors.text.secondary,
    marginTop: 8,
  },
  earlyContainer: {
    alignItems: 'center',
  },
  earlyText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  earlySubtext: {
    fontSize: 18,
    color: '#fff',
    marginTop: 8,
  },
  historyContainer: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  historyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyItem: {
    fontSize: 14,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.input,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
