import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { uploadImage } from '../../utils/storage';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';

type SEPSelfieRouteParams = {
  mode: 'baseline' | 'attempt';
  reactionAvgMs: number;
  phraseDurationSec: number;
  audioUrl: string;
  eventId?: string;
};

export default function SEPSelfieScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: SEPSelfieRouteParams }, 'params'>>();
  const { mode, reactionAvgMs, phraseDurationSec, audioUrl, eventId } = route.params;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    // Request camera permission on mount
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleNext = async () => {
    if (!capturedPhoto) {
      Alert.alert('Error', 'Please capture a selfie first.');
      return;
    }

    setIsUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload selfie to Supabase storage
      const timestamp = Date.now();
      const selfiePath = `${user.id}/${timestamp}.jpg`;
      const selfieUrl = await uploadImage(capturedPhoto, 'sep-selfies', selfiePath);

      if (mode === 'baseline') {
        // Create SEPBaseline record
        const { error: baselineError } = await supabase
          .from('sep_baselines')
          .insert({
            user_id: user.id,
            reaction_avg_ms: reactionAvgMs,
            phrase_duration_sec: phraseDurationSec,
            selfie_url: selfieUrl,
          });

        if (baselineError) {
          throw baselineError;
        }

        // Navigate to onboarding complete screen
        navigation.navigate('OnboardingComplete');
      } else {
        // For attempt mode, navigate to SEP result evaluation
        if (!eventId) {
          throw new Error('Event ID is required for SEP attempt');
        }
        
        console.log('SEPSelfieScreen navigating to SEPResult with:', {
          eventId,
          reactionAvgMs,
          phraseDurationSec,
          selfieUrl,
        });
        
        navigation.navigate('SEPResult', {
          eventId,
          reactionAvgMs,
          phraseDurationSec,
          selfieUrl,
        });
      }
    } catch (error) {
      console.error('Error saving SEP data:', error);
      Alert.alert('Error', 'Failed to save selfie. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStart = () => {
    setShowInstructions(false);
  };

  // Handle permission states
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Camera access is required for selfie verification.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (showInstructions) {
    return (
      <View style={styles.container}>
        <View style={styles.instructionsContainer}>
          <Text style={styles.title}>Selfie Capture</Text>
          <Text style={styles.subtitle}>
            {mode === 'baseline'
              ? 'Let\'s capture your baseline selfie'
              : 'Take a selfie for verification'}
          </Text>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>How it works:</Text>
            <Text style={styles.instructionsText}>
              1. Position your face in the camera frame{'\n'}
              2. Make sure you're in good lighting{'\n'}
              3. Capture a clear photo of your face{'\n'}
              4. Review and retake if needed
            </Text>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Start Capture</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Review Your Selfie</Text>
          
          <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetake}
              disabled={isUploading}
            >
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {mode === 'baseline' ? 'Complete Setup' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      />
      <View style={styles.cameraOverlay}>
        {/* Face guide overlay */}
        <View style={styles.faceGuide}>
          <View style={[styles.faceGuideCorner, styles.topLeft]} />
          <View style={[styles.faceGuideCorner, styles.topRight]} />
          <View style={[styles.faceGuideCorner, styles.bottomLeft]} />
          <View style={[styles.faceGuideCorner, styles.bottomRight]} />
        </View>

        <Text style={styles.cameraInstruction}>
          Position your face in the frame
        </Text>

        {/* Capture button */}
        <View style={styles.captureContainer}>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Preserved camera UI background
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.background.primary,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.background.primary,
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
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  faceGuide: {
    alignSelf: 'center',
    width: 250,
    height: 300,
    marginTop: 40,
  },
  faceGuideCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff', // Preserved camera UI functional color
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  cameraInstruction: {
    fontSize: 18,
    color: '#fff', // Preserved camera UI functional color
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
    borderRadius: 8,
  },
  captureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Preserved camera UI functional color
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff', // Preserved camera UI functional color
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff', // Preserved camera UI functional color
  },
  previewContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    padding: 24,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  previewImage: {
    flex: 1,
    borderRadius: 12,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  retakeButtonText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: theme.colors.primary.main,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
