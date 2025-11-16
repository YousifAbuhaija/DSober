import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../utils/storage';
import { theme } from '../../theme/colors';

interface DriverInfoScreenProps {
  navigation: any;
}

export default function DriverInfoScreen({ navigation }: DriverInfoScreenProps) {
  const { session, refreshUser, user } = useAuth();
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [licensePhotoUri, setLicensePhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Pre-fill phone number if already provided
  React.useEffect(() => {
    if (user?.phoneNumber) {
      setPhoneNumber(user.phoneNumber);
    }
  }, [user]);

  const validatePhoneNumber = (phone: string): boolean => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Check if it's a valid US phone number (10 digits)
    // or international format (11+ digits starting with 1)
    return digitsOnly.length === 10 || (digitsOnly.length >= 11 && digitsOnly[0] === '1');
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for 10 digits
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    
    // Format as +1 (XXX) XXX-XXXX for 11 digits starting with 1
    if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
      return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }
    
    // Return as-is for other formats
    return phone;
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to upload your license photo.'
      );
      return false;
    }
    return true;
  };

  const handlePhotoUpload = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLicensePhotoUri(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleNext = async () => {
    // Validate required fields
    if (!carMake.trim()) {
      Alert.alert('Error', 'Please enter your car make');
      return;
    }

    if (!carModel.trim()) {
      Alert.alert('Error', 'Please enter your car model');
      return;
    }

    if (!carPlate.trim()) {
      Alert.alert('Error', 'Please enter your license plate');
      return;
    }

    // Phone number validation (optional here since it's already collected in BasicInfo)
    if (phoneNumber.trim() && !validatePhoneNumber(phoneNumber)) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid phone number (10 digits for US numbers)'
      );
      return;
    }

    if (!licensePhotoUri) {
      Alert.alert('Error', 'Please upload a photo of your driver\'s license');
      return;
    }

    setLoading(true);

    try {
      if (!session?.user?.id) {
        throw new Error('No user session found');
      }

      // Upload license photo to Supabase storage
      setUploadingPhoto(true);
      const licensePhotoUrl = await uploadImage(
        licensePhotoUri,
        'license-photos',
        `${session.user.id}/license.jpg`
      );
      setUploadingPhoto(false);

      // Format phone number before saving (if provided)
      const formattedPhone = phoneNumber.trim() ? formatPhoneNumber(phoneNumber) : user?.phoneNumber;

      // Update user profile with driver information
      const updateData: any = {
        car_make: carMake.trim(),
        car_model: carModel.trim(),
        car_plate: carPlate.trim().toUpperCase(),
        license_photo_url: licensePhotoUrl,
        updated_at: new Date().toISOString(),
      };

      // Only update phone number if it was changed
      if (formattedPhone) {
        updateData.phone_number = formattedPhone;
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', session.user.id);

      if (error) throw error;

      // Navigate to profile photo screen
      navigation.navigate('ProfilePhoto');

      // Refresh user context after navigation (non-blocking)
      refreshUser().catch(err => console.error('Error refreshing user:', err));
    } catch (error: any) {
      console.error('Error saving driver info:', error);
      Alert.alert('Error', error.message || 'Failed to save driver information. Please try again.');
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Information</Text>
        <Text style={styles.subtitle}>
          Provide your vehicle details and driver's license
        </Text>
      </View>

      <View style={styles.form}>
        {/* Car Make Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Car Make *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Toyota, Honda, Ford"
            placeholderTextColor={theme.colors.text.tertiary}
            value={carMake}
            onChangeText={setCarMake}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Car Model Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Car Model *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Camry, Civic, F-150"
            placeholderTextColor={theme.colors.text.tertiary}
            value={carModel}
            onChangeText={setCarModel}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* License Plate Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>License Plate *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., ABC1234"
            placeholderTextColor={theme.colors.text.tertiary}
            value={carPlate}
            onChangeText={setCarPlate}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />
        </View>

        {/* Phone Number Input (optional - can update if needed) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., (555) 123-4567"
            placeholderTextColor={theme.colors.text.tertiary}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoCorrect={false}
            maxLength={20}
          />
          <Text style={styles.hint}>
            Update your phone number if needed (already provided during signup)
          </Text>
        </View>

        {/* License Photo Upload */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Driver's License Photo *</Text>
          <Text style={styles.hint}>
            Upload a clear photo of your driver's license for verification
          </Text>
          
          {licensePhotoUri ? (
            <View style={styles.photoPreviewContainer}>
              <Image
                source={{ uri: licensePhotoUri }}
                style={styles.photoPreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handlePhotoUpload}
              >
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handlePhotoUpload}
            >
              <Text style={styles.uploadButtonText}>📷 Upload License Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.text.onPrimary} />
              <Text style={styles.nextButtonText}>
                {uploadingPhoto ? 'Uploading photo...' : 'Saving...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.nextButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your license photo is stored securely and only visible to chapter admins.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  contentContainer: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    lineHeight: 22,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.colors.background.input,
    color: theme.colors.text.primary,
  },
  hint: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: theme.colors.primary.light,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.primary.dark,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    color: theme.colors.primary.light,
    fontWeight: '600',
  },
  photoPreviewContainer: {
    gap: 12,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: theme.colors.background.elevated,
  },
  changePhotoButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary.light,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 16,
    color: theme.colors.primary.light,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonDisabled: {
    backgroundColor: theme.colors.state.disabled,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.default,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
