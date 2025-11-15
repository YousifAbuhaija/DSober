import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../utils/storage';

interface ProfilePhotoScreenProps {
  navigation: any;
}

export default function ProfilePhotoScreen({ navigation }: ProfilePhotoScreenProps) {
  const { session, refreshUser } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera access to take your profile photo.'
      );
      return false;
    }
    return true;
  };

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to select your profile photo.'
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleChoosePhoto = async () => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error choosing photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
  };

  const handleContinue = async () => {
    if (!photoUri) {
      Alert.alert('Error', 'Please take or select a profile photo');
      return;
    }

    setLoading(true);

    try {
      if (!session?.user?.id) {
        throw new Error('No user session found');
      }

      // Upload profile photo to Supabase storage
      setUploadingPhoto(true);
      const profilePhotoUrl = await uploadImage(
        photoUri,
        'profile-photos',
        `${session.user.id}/profile.jpg`
      );
      setUploadingPhoto(false);

      // Update user profile with photo URL
      const { error } = await supabase
        .from('users')
        .update({
          profile_photo_url: profilePhotoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      // Navigate to SEP baseline flow
      navigation.navigate('SEPReaction', { mode: 'baseline' });

      // Refresh user context after navigation (non-blocking)
      refreshUser().catch(err => console.error('Error refreshing user:', err));
    } catch (error: any) {
      console.error('Error saving profile photo:', error);
      Alert.alert('Error', error.message || 'Failed to save profile photo. Please try again.');
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile Photo</Text>
        <Text style={styles.subtitle}>
          Take a clear photo of yourself for your DD profile
        </Text>
      </View>

      <View style={styles.consentBox}>
        <Text style={styles.consentIcon}>ℹ️</Text>
        <Text style={styles.consentText}>
          Your profile photo will be visible to members when you're an active DD. 
          This helps riders identify you at events.
        </Text>
      </View>

      {photoUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.photoPreview}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={handleRetake}
          >
            <Text style={styles.retakeButtonText}>Retake Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.captureContainer}>
          <View style={styles.placeholderCircle}>
            <Text style={styles.placeholderIcon}>📷</Text>
          </View>
          
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleTakePhoto}
            >
              <Text style={styles.captureButtonText}>📸 Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chooseButton}
              onPress={handleChoosePhoto}
            >
              <Text style={styles.chooseButtonText}>🖼️ Choose from Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.continueButton, (!photoUri || loading) && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!photoUri || loading}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.continueButtonText}>
              {uploadingPhoto ? 'Uploading photo...' : 'Saving...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.continueButtonText}>Continue</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your photo is stored securely and only visible when you're an active DD.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  header: {
    marginBottom: 24,
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
  consentBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  consentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  photoPreview: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#f5f5f5',
    borderWidth: 4,
    borderColor: '#007AFF',
  },
  retakeButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retakeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  captureContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  placeholderCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#f5f5f5',
    borderWidth: 3,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  captureButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chooseButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  chooseButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
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
