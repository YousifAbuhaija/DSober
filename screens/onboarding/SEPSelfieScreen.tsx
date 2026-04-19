import React, { useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { uploadImage } from '../../utils/storage';
import { supabase } from '../../lib/supabase';
import StepProgress from '../../components/ui/StepProgress';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import EmptyState from '../../components/ui/EmptyState';
import { colors, spacing, typography, radii } from '../../theme';

type RouteParams = {
  mode: 'baseline' | 'attempt';
  reactionAvgMs: number;
  phraseDurationSec: number;
  audioUrl: string;
  eventId?: string;
};

export default function SEPSelfieScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { mode, reactionAvgMs, phraseDurationSec, audioUrl, eventId } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <LoadingScreen />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <EmptyState
          icon="camera-off-outline"
          title="Camera access required"
          subtitle="DSober needs camera access to capture your selfie for verification."
          action={{ label: 'Grant Access', onPress: requestPermission }}
        />
      </SafeAreaView>
    );
  }

  const capture = async () => {
    const p = await cameraRef.current?.takePictureAsync({ quality: 0.8, base64: false });
    if (p?.uri) setPhoto(p.uri);
  };

  const handleNext = async () => {
    if (!photo) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const selfieUrl = await uploadImage(photo, 'sep-selfies', `${user.id}/${Date.now()}.jpg`);

      if (mode === 'baseline') {
        await supabase.from('sep_baselines').insert({
          user_id: user.id,
          reaction_avg_ms: reactionAvgMs,
          phrase_duration_sec: phraseDurationSec,
          selfie_url: selfieUrl,
        });
        navigation.navigate('OnboardingComplete');
      } else {
        navigation.navigate('SEPResult', { eventId, reactionAvgMs, phraseDurationSec, selfieUrl });
      }
    } catch {
      // user can retry
    } finally {
      setUploading(false);
    }
  };

  if (photo) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.previewPage}>
          <StepProgress current={2} total={3} label="Selfie Capture" />
          <Text style={styles.previewTitle}>Looks good?</Text>
          <Image source={{ uri: photo }} style={styles.previewImg} />
          <View style={styles.previewActions}>
            <Button variant="secondary" onPress={() => setPhoto(null)} label="Retake" style={styles.halfBtn} />
            <Button
              onPress={handleNext}
              loading={uploading}
              label={mode === 'baseline' ? 'Finish Setup' : 'Continue'}
              style={styles.halfBtn}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

      {/* Overlay */}
      <View style={styles.overlay}>
        <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
          <View style={styles.topBar}>
            <StepProgress current={2} total={3} label="Selfie Capture" />
          </View>

          {/* Face guide */}
          <View style={styles.guideArea}>
            <View style={styles.faceGuide}>
              {(['tl','tr','bl','br'] as const).map((corner) => (
                <View key={corner} style={[styles.corner, styles[corner]]} />
              ))}
            </View>
            <Text style={styles.guideLabel}>Center your face</Text>
          </View>

          {/* Capture */}
          <View style={styles.captureArea}>
            <TouchableOpacity style={styles.captureBtn} onPress={capture} activeOpacity={0.85}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_BORDER = 3;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  fill: { flex: 1 },
  // Preview page
  previewPage: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  previewTitle: {
    ...typography.title2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  previewImg: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.bg.elevated,
    marginBottom: spacing.xl,
  },
  previewActions: { flexDirection: 'row', gap: spacing.md },
  halfBtn: { flex: 1 },
  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject },
  topBar: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.xl,
  },
  guideArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  faceGuide: {
    width: 220,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#FFFFFF',
    borderWidth: CORNER_BORDER,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  guideLabel: {
    ...typography.callout,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  captureArea: {
    alignItems: 'center',
    paddingBottom: spacing['3xl'],
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
});
