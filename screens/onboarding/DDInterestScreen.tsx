import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';

interface DDInterestScreenProps {
  navigation: any;
}

export default function DDInterestScreen({ navigation }: DDInterestScreenProps) {
  const { session, refreshUser } = useAuth();
  const [isDD, setIsDD] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (isDD === null) {
      Alert.alert('Please Select', 'Please indicate if you want to be a designated driver');
      return;
    }

    setLoading(true);

    try {
      if (!session?.user?.id) {
        throw new Error('No user session found');
      }

      // Update user's isDD field and dd_status
      const { error } = await supabase
        .from('users')
        .update({
          is_dd: isDD,
          dd_status: isDD ? 'active' : 'none',
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      // Navigate based on DD selection first
      if (isDD) {
        // If user wants to be a DD, go to driver info screen
        navigation.navigate('DriverInfo');
      } else {
        // If not a DD, go to SEP baseline
        navigation.navigate('SEPReaction', { mode: 'baseline' });
      }

      // Refresh user context after navigation (non-blocking)
      refreshUser().catch(err => console.error('Error refreshing user:', err));
    } catch (error: any) {
      console.error('Error saving DD preference:', error);
      Alert.alert('Error', error.message || 'Failed to save preference. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Designated Driver</Text>
          <Text style={styles.subtitle}>
            Would you like to be a designated driver for your chapter's events?
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What does this mean?</Text>
          <Text style={styles.infoText}>
            • You'll be able to volunteer to drive for events{'\n'}
            • You'll need to pass a sobriety verification before each session{'\n'}
            • You'll provide your car information and license photo{'\n'}
            • Members can find you when they need a safe ride
          </Text>
        </View>

        <View style={styles.optionContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              isDD === true && styles.optionButtonSelected,
            ]}
            onPress={() => setIsDD(true)}
          >
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  isDD === true && styles.optionTitleSelected,
                ]}
              >
                Yes, I want to be a DD
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  isDD === true && styles.optionDescriptionSelected,
                ]}
              >
                Help keep your chapter safe
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              isDD === false && styles.optionButtonSelected,
            ]}
            onPress={() => setIsDD(false)}
          >
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  isDD === false && styles.optionTitleSelected,
                ]}
              >
                No, not at this time
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  isDD === false && styles.optionDescriptionSelected,
                ]}
              >
                You can change this later in settings
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.text.onPrimary} />
          ) : (
            <Text style={styles.nextButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
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
  infoBox: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  optionContainer: {
    gap: 12,
    marginBottom: 32,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: theme.colors.border.default,
    borderRadius: 12,
    padding: 16,
    backgroundColor: theme.colors.background.input,
  },
  optionButtonSelected: {
    borderColor: theme.colors.primary.main,
    backgroundColor: theme.colors.primary.dark,
  },
  optionContent: {
    gap: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  optionTitleSelected: {
    color: theme.colors.secondary.main,
  },
  optionDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  optionDescriptionSelected: {
    color: theme.colors.secondary.light,
  },
  nextButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: theme.colors.state.disabled,
  },
  nextButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
