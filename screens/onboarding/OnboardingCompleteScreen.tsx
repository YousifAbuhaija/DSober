import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

interface OnboardingCompleteScreenProps {
  navigation: any;
}

export default function OnboardingCompleteScreen({ navigation }: OnboardingCompleteScreenProps) {
  const { refreshUser } = useAuth();

  const handleContinue = async () => {
    console.log('Get Started button pressed');
    try {
      // Refresh user data to update onboarding status
      await refreshUser();
      console.log('User refreshed, RootNavigator should transition to MainApp');
      // Navigation will be handled by RootNavigator based on updated user state
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.checkmarkCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        </View>

        {/* Title and Message */}
        <Text style={styles.title}>Setup Complete!</Text>
        <Text style={styles.message}>
          You're all set to use DSober. Your baseline has been established and you can now access all features.
        </Text>

        {/* Summary Box */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>What's Next?</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>•</Text>
            <Text style={styles.summaryText}>
              View upcoming events in your chapter
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>•</Text>
            <Text style={styles.summaryText}>
              Request to be a DD for events
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>•</Text>
            <Text style={styles.summaryText}>
              Find active DDs when you need a ride
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>•</Text>
            <Text style={styles.summaryText}>
              Complete SEP verification before driving
            </Text>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Get Started</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 60,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  summaryBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  summaryBullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 8,
    fontWeight: 'bold',
  },
  summaryText: {
    flex: 1,
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
