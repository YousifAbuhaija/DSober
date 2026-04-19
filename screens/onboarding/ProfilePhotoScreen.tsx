import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../utils/storage';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Button from '../../components/ui/Button';
import StepProgress from '../../components/ui/StepProgress';
import { colors, spacing, typography, radii } from '../../theme';

const TOTAL_STEPS = 8;
const PHOTO_SIZE = 220;

export default function ProfilePhotoScreen({ navigation }: any) {
  const { session } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pick = async (fromCamera: boolean) => {
    const { status } = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      setError(`${fromCamera ? 'Camera' : 'Photo library'} access is required`);
      return;
    }
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await fn({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setError('');
    }
  };

  const handleContinue = async () => {
    if (!photoUri) { setError('Please add a profile photo to continue'); return; }
    setLoading(true);
    try {
      const url = await uploadImage(photoUri, 'profile-photos', `${session!.user.id}/profile.jpg`);
      await supabase
        .from('users')
        .update({ profile_photo_url: url, updated_at: new Date().toISOString() })
        .eq('id', session!.user.id);
      navigation.navigate('SEPReaction', { mode: 'baseline' });
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => navigation.navigate('SEPReaction', { mode: 'baseline' });

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <StepProgress current={4} total={TOTAL_STEPS} label="Profile Photo" />

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Profile Photo</Text>
          <Text style={styles.subtitle}>
            Riders will see this when you're on duty as a DD.
          </Text>
        </View>

        <View style={styles.photoArea}>
          {photoUri ? (
            <>
              <Image source={{ uri: photoUri }} style={styles.photo} />
              <TouchableOpacity style={styles.retake} onPress={() => setPhotoUri(null)}>
                <Ionicons name="refresh-outline" size={16} color={colors.brand.primary} />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="person-outline" size={56} color={colors.text.tertiary} />
            </View>
          )}
        </View>

        {!photoUri && (
          <View style={styles.pickButtons}>
            <Button
              onPress={() => pick(true)}
              label="Take Photo"
              variant="primary"
              fullWidth
              leftIcon={<Ionicons name="camera-outline" size={18} color="#fff" />}
            />
            <Button
              onPress={() => pick(false)}
              label="Choose from Library"
              variant="secondary"
              fullWidth
              leftIcon={<Ionicons name="images-outline" size={18} color={colors.text.primary} />}
            />
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {photoUri && (
          <Button
            onPress={handleContinue}
            label="Continue"
            loading={loading}
            fullWidth
            size="lg"
            style={styles.cta}
          />
        )}

        <TouchableOpacity style={styles.skipLink} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  headingBlock: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.title1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.callout,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  photoArea: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    gap: spacing.base,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.elevated,
  },
  placeholder: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  retakeText: {
    ...typography.callout,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  pickButtons: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  errorText: {
    ...typography.caption,
    color: colors.ui.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  cta: {
    marginBottom: spacing.md,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipText: {
    ...typography.callout,
    color: colors.text.tertiary,
  },
});
