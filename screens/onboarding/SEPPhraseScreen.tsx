import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { 
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { uploadAudio } from '../../utils/storage';
import { supabase } from '../../lib/supabase';

type SEPPhraseRouteParams = {
  mode: 'baseline' | 'attempt';
  reactionAvgMs: number;
  eventId?: string;
};

const FIXED_PHRASE = "I am the designated driver for tonight's event";

export default function SEPPhraseScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: SEPPhraseRouteParams }, 'params'>>();
  const { mode, reactionAvgMs, eventId } = route.params;
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100); // Update every 100ms for smooth timer
  const audioPlayer = useAudioPlayer(null);
  const [phraseDurationSec, setPhraseDurationSec] = useState<number | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Request audio permissions on mount
    requestAudioPermission();
  }, []);

  const requestAudioPermission = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Microphone access is required for phrase recording.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      // Set audio mode to allow recording on iOS
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      
      return true;
    } catch (error) {
      console.error('Error requesting audio permission:', error);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      
      // Ensure permissions and audio mode are set before recording
      const hasPermission = await requestAudioPermission();
      console.log('Has permission:', hasPermission);
      
      if (!hasPermission) {
        Alert.alert('Error', 'Microphone permission is required to record.');
        return;
      }
      
      // Prepare the recorder if not ready
      if (!recorderState.canRecord) {
        console.log('Preparing recorder...');
        await audioRecorder.prepareToRecordAsync();
        console.log('Recorder prepared');
      }
      
      console.log('About to call audioRecorder.record()');
      await audioRecorder.record();
      console.log('Recording started successfully');
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      
      // Check if error is due to audio session conflict (call, music, etc.)
      const errorMessage = error?.message || '';
      if (errorMessage.includes('Session activation failed') || 
          errorMessage.includes('audio session') ||
          errorMessage.includes('configure audio')) {
        Alert.alert(
          'Audio In Use',
          'Cannot record audio. Please end any phone calls, close other apps using the microphone, and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to start recording. Please try again.');
      }
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      
      // Get the recording URI from the recorder
      const uri = audioRecorder.uri;
      
      if (uri) {
        // Get the final duration from the recorder state (in seconds)
        const duration = recorderState.durationMillis / 1000;
        setPhraseDurationSec(duration);
        setAudioUri(uri);
      } else {
        Alert.alert('Error', 'Failed to get recording. Please try again.');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const handleRecordToggle = () => {
    if (recorderState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleRetry = () => {
    setPhraseDurationSec(null);
    setAudioUri(null);
  };

  const handlePlayback = async () => {
    if (!audioUri) return;

    try {
      if (isPlaying) {
        // Stop playback
        audioPlayer.pause();
        setIsPlaying(false);
      } else {
        // Set audio mode for playback (louder volume)
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
        
        // Replace the audio source and play
        audioPlayer.replace(audioUri);
        audioPlayer.play();
        setIsPlaying(true);
        
        // Listen for when playback finishes
        const checkPlayback = setInterval(() => {
          if (!audioPlayer.playing) {
            setIsPlaying(false);
            clearInterval(checkPlayback);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error with playback:', error);
      setIsPlaying(false);
      Alert.alert('Error', 'Failed to play recording.');
    }
  };

  const handleNext = async () => {
    if (!audioUri || phraseDurationSec === null) {
      Alert.alert('Error', 'Please record the phrase first.');
      return;
    }

    setIsUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload audio to Supabase storage
      const timestamp = Date.now();
      const audioPath = `${user.id}/${timestamp}.m4a`;
      const audioUrl = await uploadAudio(audioUri, 'sep-audio', audioPath);

      // Navigate to next screen with all data
      console.log('SEPPhraseScreen navigating with:', {
        mode,
        eventId,
        reactionAvgMs,
        phraseDurationSec,
        audioUrl,
      });
      
      if (mode === 'baseline') {
        navigation.navigate('SEPSelfie', {
          mode: 'baseline',
          reactionAvgMs,
          phraseDurationSec,
          audioUrl,
        });
      } else {
        navigation.navigate('SEPSelfie', {
          mode: 'attempt',
          eventId,
          reactionAvgMs,
          phraseDurationSec,
          audioUrl,
        });
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      Alert.alert('Error', 'Failed to upload audio. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStart = () => {
    setShowInstructions(false);
  };

  if (showInstructions) {
    return (
      <View style={styles.container}>
        <View style={styles.instructionsContainer}>
          <Text style={styles.title}>Phrase Recording Test</Text>
          <Text style={styles.subtitle}>
            {mode === 'baseline'
              ? 'Let\'s establish your baseline speech duration'
              : 'Record the phrase at your current pace'}
          </Text>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>How it works:</Text>
            <Text style={styles.instructionsText}>
              1. Read the phrase displayed on screen{'\n'}
              2. Press "Start Recording" and speak clearly{'\n'}
              3. Press "Stop Recording" when finished{'\n'}
              4. Review your recording duration{'\n'}
              5. Re-record if needed or continue
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
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Phrase Display */}
        <View style={styles.phraseContainer}>
          <Text style={styles.phraseLabel}>Read this phrase:</Text>
          <View style={styles.phraseBox}>
            <Text style={styles.phraseText}>{FIXED_PHRASE}</Text>
          </View>
        </View>

        {/* Recording Controls */}
        <View style={styles.controlsContainer}>
          {phraseDurationSec === null ? (
            <>
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  recorderState.isRecording && styles.recordButtonActive,
                ]}
                onPress={handleRecordToggle}
                disabled={isUploading}
              >
                <View style={[
                  styles.recordButtonInner,
                  recorderState.isRecording && styles.recordButtonInnerActive,
                ]} />
              </TouchableOpacity>

              <Text style={styles.recordLabel}>
                {recorderState.isRecording ? 'Stop Recording' : 'Start Recording'}
              </Text>

              {recorderState.isRecording && (
                <View style={styles.durationContainer}>
                  <Text style={styles.durationText}>
                    {(recorderState.durationMillis / 1000).toFixed(2)}s
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.resultContainer}>
                <Text style={styles.resultLabel}>Recording Duration:</Text>
                <Text style={styles.resultValue}>
                  {phraseDurationSec.toFixed(2)}s
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.playbackButton,
                  isPlaying && styles.playbackButtonActive
                ]}
                onPress={handlePlayback}
                disabled={isUploading}
              >
                <Text style={styles.playbackButtonText}>
                  {isPlaying ? '⏸ Stop Playback' : '▶ Play Recording'}
                </Text>
              </TouchableOpacity>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetry}
                  disabled={isUploading}
                >
                  <Text style={styles.retryButtonText}>Record Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNext}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.nextButtonText}>Next</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Instructions */}
        {!audioRecorder.isRecording && phraseDurationSec === null && (
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>Tips:</Text>
            <Text style={styles.tipsText}>
              • Speak at your normal pace{'\n'}
              • Speak clearly and naturally{'\n'}
              • Find a quiet location
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  instructionsContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  instructionsBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  phraseContainer: {
    marginTop: 20,
  },
  phraseLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  phraseBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  phraseText: {
    fontSize: 20,
    color: '#000',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '500',
  },
  controlsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordButtonActive: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFE5E5',
  },
  recordButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
  },
  recordButtonInnerActive: {
    borderRadius: 8,
    width: 40,
    height: 40,
  },
  recordLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  durationContainer: {
    marginTop: 16,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  resultContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  playbackButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  playbackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retryButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipsContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  playbackButtonActive: {
    backgroundColor: '#FF9500',
  },
});
