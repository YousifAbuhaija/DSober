import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { uploadAudio } from '../../utils/storage';
import { supabase } from '../../lib/supabase';
import StepProgress from '../../components/ui/StepProgress';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { colors, spacing, typography, radii } from '../../theme';

type RouteParams = {
  mode: 'baseline' | 'attempt';
  reactionAvgMs: number;
  eventId?: string;
};

const PHRASE = "I am the designated driver for tonight's event";

export default function SEPPhraseScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { mode, reactionAvgMs, eventId } = route.params;

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100);
  const audioPlayer = useAudioPlayer(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setHasPermission(granted);
      if (granted) {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      }
    })();
  }, []);

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <EmptyState
          icon="mic-off-outline"
          title="Microphone access required"
          subtitle="DSober needs microphone access to record your phrase. Please enable it in Settings."
        />
      </SafeAreaView>
    );
  }

  const startRecording = async () => {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    if (!recorderState.canRecord) await audioRecorder.prepareToRecordAsync();
    await audioRecorder.record();
  };

  const stopRecording = async () => {
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (uri) {
      setDuration(recorderState.durationMillis / 1000);
      setAudioUri(uri);
    }
  };

  const toggleRecord = () => recorderState.isRecording ? stopRecording() : startRecording();

  const handlePlayback = async () => {
    if (!audioUri) return;
    if (isPlaying) {
      audioPlayer.pause();
      setIsPlaying(false);
    } else {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      audioPlayer.replace(audioUri);
      audioPlayer.play();
      setIsPlaying(true);
      const check = setInterval(() => {
        if (!audioPlayer.playing) { setIsPlaying(false); clearInterval(check); }
      }, 100);
    }
  };

  const handleRetry = () => { setDuration(null); setAudioUri(null); setIsPlaying(false); };

  const handleNext = async () => {
    if (!audioUri || duration === null) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const path = `${user.id}/${Date.now()}.m4a`;
      const audioUrl = await uploadAudio(audioUri, 'sep-audio', path);
      const params = mode === 'baseline'
        ? { mode: 'baseline', reactionAvgMs, phraseDurationSec: duration, audioUrl }
        : { mode: 'attempt', eventId, reactionAvgMs, phraseDurationSec: duration, audioUrl };
      navigation.navigate('SEPSelfie', params);
    } catch {
      // handled silently — user can retry
    } finally {
      setUploading(false);
    }
  };

  const recorded = duration !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <StepProgress current={1} total={3} label="Phrase Recording" />

        <View style={styles.body}>
          <Text style={styles.title}>Read the phrase</Text>
          <Text style={styles.subtitle}>Speak clearly at your natural pace.</Text>

          <Card style={styles.phraseCard}>
            <Text style={styles.phraseText}>"{PHRASE}"</Text>
          </Card>

          {recorded ? (
            <View style={styles.resultBlock}>
              <View style={styles.durationRow}>
                <Text style={styles.durationValue}>{duration.toFixed(2)}</Text>
                <Text style={styles.durationUnit}>sec</Text>
              </View>

              <TouchableOpacity style={styles.playBtn} onPress={handlePlayback}>
                <Ionicons
                  name={isPlaying ? 'pause-circle' : 'play-circle'}
                  size={48}
                  color={colors.brand.primary}
                />
                <Text style={styles.playLabel}>{isPlaying ? 'Pause' : 'Play back'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.recordBlock}>
              <TouchableOpacity
                style={[styles.recordBtn, recorderState.isRecording && styles.recordBtnActive]}
                onPress={toggleRecord}
                activeOpacity={0.85}
              >
                <View style={[styles.recordDot, recorderState.isRecording && styles.recordDotActive]} />
              </TouchableOpacity>
              <Text style={styles.recordLabel}>
                {recorderState.isRecording
                  ? `${(recorderState.durationMillis / 1000).toFixed(1)}s — tap to stop`
                  : 'Tap to record'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {recorded && (
            <Button variant="secondary" onPress={handleRetry} label="Record Again" fullWidth style={styles.retryBtn} />
          )}
          <Button
            onPress={handleNext}
            label="Continue"
            loading={uploading}
            disabled={!recorded}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing['2xl'] },
  body: { flex: 1, justifyContent: 'center' },
  title: { ...typography.title2, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.callout, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.xl },
  phraseCard: {
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.faint,
    marginBottom: spacing['2xl'],
  },
  phraseText: {
    ...typography.title3,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  recordBlock: { alignItems: 'center', gap: spacing.base },
  recordBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: colors.ui.error,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
  },
  recordBtnActive: { borderColor: colors.ui.error, backgroundColor: '#2A0A0A' },
  recordDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ui.error,
  },
  recordDotActive: {
    borderRadius: 8,
    width: 32,
    height: 32,
  },
  recordLabel: { ...typography.callout, color: colors.text.secondary },
  resultBlock: { alignItems: 'center', gap: spacing.xl },
  durationRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  durationValue: { fontSize: 56, fontWeight: '700', color: colors.text.primary, lineHeight: 64 },
  durationUnit: { ...typography.title3, color: colors.text.tertiary },
  playBtn: { alignItems: 'center', gap: spacing.xs },
  playLabel: { ...typography.caption, color: colors.brand.primary, fontWeight: '600' },
  actions: { gap: spacing.md },
  retryBtn: {},
});
