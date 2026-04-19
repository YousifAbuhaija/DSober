import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet, Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../utils/storage';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StepProgress from '../../components/ui/StepProgress';
import { colors, spacing, typography, radii } from '../../theme';

const TOTAL_STEPS = 8;

function isValidPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 || (d.length === 11 && d[0] === '1');
}
function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

export default function DriverInfoScreen({ navigation, route }: any) {
  const { session, user, refreshUser } = useAuth();
  const mode: 'onboarding' | 'upgrade' = route?.params?.mode ?? 'onboarding';

  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const modelRef = useRef<TextInput>(null);
  const plateRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user?.phoneNumber) setPhone(user.phoneNumber);
  }, [user]);

  const clearErr = (k: string) => setErrors((e) => { const n = { ...e }; delete n[k]; return n; });

  const pickLicense = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Access Required',
        'DSober needs photo library access to upload your license.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLicenseUri(result.assets[0].uri);
      clearErr('license');
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!carMake.trim()) next.carMake = 'Car make is required';
    if (!carModel.trim()) next.carModel = 'Car model is required';
    if (!carPlate.trim()) next.carPlate = 'License plate is required';
    if (phone.trim() && !isValidPhone(phone)) next.phone = 'Enter a valid 10-digit US number';
    if (!licenseUri) next.license = "Driver's license photo is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const licenseUrl = await uploadImage(licenseUri!, 'license-photos', `${session!.user.id}/license.jpg`);
      const update: Record<string, any> = {
        car_make: carMake.trim(),
        car_model: carModel.trim(),
        car_plate: carPlate.trim().toUpperCase(),
        license_photo_url: licenseUrl,
        updated_at: new Date().toISOString(),
      };
      if (phone.trim()) update.phone_number = formatPhone(phone);
      if (mode === 'upgrade') { update.is_dd = true; update.dd_status = 'active'; }

      await supabase.from('users').update(update).eq('id', session!.user.id);

      if (mode === 'upgrade') {
        await refreshUser();
        navigation.goBack();
      } else {
        navigation.navigate('ProfilePhoto');
      }
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Failed to save. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = mode === 'upgrade' ? 0 : 3;

  return (
    <ScreenWrapper keyboard scroll>
      <View style={styles.container}>
        {mode === 'onboarding' && (
          <StepProgress current={stepIndex} total={TOTAL_STEPS} label="Driver Info" />
        )}

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Driver Information</Text>
          <Text style={styles.subtitle}>Vehicle details and license for your DD profile.</Text>
        </View>

        <Input
          label="Car Make"
          value={carMake}
          onChangeText={(v) => { setCarMake(v); clearErr('carMake'); }}
          error={errors.carMake}
          placeholder="e.g. Toyota, Honda, Ford"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => modelRef.current?.focus()}
        />
        <Input
          ref={modelRef}
          label="Car Model"
          value={carModel}
          onChangeText={(v) => { setCarModel(v); clearErr('carModel'); }}
          error={errors.carModel}
          placeholder="e.g. Camry, Civic, F-150"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => plateRef.current?.focus()}
        />
        <Input
          ref={plateRef}
          label="License Plate"
          value={carPlate}
          onChangeText={(v) => { setCarPlate(v); clearErr('carPlate'); }}
          error={errors.carPlate}
          placeholder="e.g. ABC1234"
          autoCapitalize="characters"
          maxLength={10}
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <Input
          ref={phoneRef}
          label="Phone Number"
          value={phone}
          onChangeText={(v) => { setPhone(v); clearErr('phone'); }}
          error={errors.phone}
          hint="Update if different from what you entered earlier"
          keyboardType="phone-pad"
          maxLength={20}
          returnKeyType="done"
        />

        {/* License photo */}
        <View style={styles.photoBlock}>
          <Text style={styles.fieldLabel}>Driver's License Photo</Text>
          {licenseUri ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: licenseUri }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.changePhoto} onPress={pickLicense}>
                <Ionicons name="camera-outline" size={16} color={colors.brand.primary} />
                <Text style={styles.changePhotoText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.uploadArea, errors.license ? styles.uploadAreaError : null]}
              onPress={pickLicense}
              activeOpacity={0.75}
            >
              <Ionicons name="id-card-outline" size={28} color={errors.license ? colors.ui.error : colors.text.tertiary} />
              <Text style={[styles.uploadText, errors.license ? { color: colors.ui.error } : null]}>
                Upload license photo
              </Text>
              <Text style={styles.uploadHint}>JPG or PNG, max 10MB</Text>
            </TouchableOpacity>
          )}
          {errors.license && <Text style={styles.errorText}>{errors.license}</Text>}
        </View>

        <Text style={styles.privacyNote}>
          Your license is stored securely and only visible to chapter admins.
        </Text>

        {errors.submit && <Text style={styles.errorText}>{errors.submit}</Text>}

        <Button
          onPress={handleNext}
          label={loading ? (mode === 'upgrade' ? 'Saving…' : 'Uploading…') : (mode === 'upgrade' ? 'Save Changes' : 'Continue')}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.cta}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  headingBlock: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.callout,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  photoBlock: {
    marginBottom: spacing.base,
  },
  photoPreviewWrap: {
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    backgroundColor: colors.bg.elevated,
  },
  changePhoto: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  changePhotoText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  uploadArea: {
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.input,
  },
  uploadAreaError: {
    borderColor: colors.ui.error,
  },
  uploadText: {
    ...typography.callout,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  uploadHint: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  privacyNote: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  errorText: {
    ...typography.caption,
    color: colors.ui.error,
    marginTop: spacing.xs,
  },
  cta: {
    marginTop: spacing.sm,
  },
});
