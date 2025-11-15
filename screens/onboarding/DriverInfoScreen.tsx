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

interface DriverInfoScreenProps {
  navigation: any;
}

export default function DriverInfoScreen({ navigation }: DriverInfoScreenProps) {
  const { session, refreshUser } = useAuth();
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [licensePhotoUri, setLicensePhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

      // Update user profile with driver information
      const { error } = await supabase
        .from('users')
        .update({
          car_make: carMake.trim(),
          car_model: carModel.trim(),
          car_plate: carPlate.trim().toUpperCase(),
          license_photo_url: licensePhotoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      // Navigate to SEP baseline first
      navigation.navigate('SEPReaction', { mode: 'baseline' });

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
            value={carPlate}
            onChangeText={setCarPlate}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />
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
              <ActivityIndicator color="#fff" />
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
    backgroundColor: '#fff',
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
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
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
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 14,
    color: '#999',
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  photoPreviewContainer: {
    gap: 12,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  changePhotoButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
