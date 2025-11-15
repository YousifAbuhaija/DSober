import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface BasicInfoScreenProps {
  navigation: any;
}

export default function BasicInfoScreen({ navigation }: BasicInfoScreenProps) {
  const { session, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [birthdayText, setBirthdayText] = useState('');
  const [gender, setGender] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2000);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedDay, setSelectedDay] = useState(1);

  // Calculate age from birthday
  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const parseBirthday = (text: string): Date | null => {
    // Expected format: MM/DD/YYYY
    const parts = text.split('/');
    if (parts.length !== 3) return null;
    
    const month = parseInt(parts[0], 10) - 1; // 0-indexed
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
    if (month < 0 || month > 11) return null;
    if (day < 1 || day > 31) return null;
    if (year < 1900 || year > new Date().getFullYear()) return null;
    
    return new Date(year, month, day);
  };

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

  const handleNext = async () => {
    // Validate required fields
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!birthdayText.trim()) {
      Alert.alert('Error', 'Please enter your birthday');
      return;
    }

    const birthday = parseBirthday(birthdayText);
    if (!birthday) {
      Alert.alert('Error', 'Please enter a valid birthday in MM/DD/YYYY format');
      return;
    }

    if (!gender) {
      Alert.alert('Error', 'Please select your gender');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid phone number (10 digits for US numbers)'
      );
      return;
    }

    const age = calculateAge(birthday);
    if (age < 18) {
      Alert.alert('Error', 'You must be at least 18 years old to use this app');
      return;
    }

    setLoading(true);

    try {
      if (!session?.user?.id) {
        throw new Error('No user session found');
      }

      // Format phone number before saving
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Update user profile in database
      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          birthday: birthday.toISOString(),
          age,
          gender,
          phone_number: formattedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      // Navigate to group join screen first
      navigation.navigate('GroupJoin');
      
      // Refresh user context after navigation (non-blocking)
      refreshUser().catch(err => console.error('Error refreshing user:', err));
    } catch (error: any) {
      console.error('Error saving basic info:', error);
      Alert.alert('Error', error.message || 'Failed to save information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatBirthday = (text: string): string => {
    // Auto-format as user types: MM/DD/YYYY
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length >= 2) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length >= 4) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
    }
    
    return formatted;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to DSober</Text>
        <Text style={styles.subtitle}>Let's get to know you</Text>
      </View>

      <View style={styles.form}>
        {/* Name Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Birthday Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Birthday *</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/DD/YYYY"
            value={birthdayText}
            onChangeText={(text) => setBirthdayText(formatBirthday(text))}
            keyboardType="numeric"
            maxLength={10}
          />
          <Text style={styles.hint}>
            Enter your date of birth (must be 18+)
          </Text>
        </View>

        {/* Gender Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender *</Text>
          <View style={styles.genderContainer}>
            {['Male', 'Female', 'Other', 'Prefer not to say'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderButton,
                  gender === option && styles.genderButtonSelected,
                ]}
                onPress={() => setGender(option)}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === option && styles.genderButtonTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Phone Number Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 123-4567"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoCorrect={false}
            maxLength={20}
          />
          <Text style={styles.hint}>
            Your phone number allows DDs and riders to coordinate pickups
          </Text>
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          <Text style={styles.nextButtonText}>
            {loading ? 'Saving...' : 'Next'}
          </Text>
        </TouchableOpacity>
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
    marginTop: 40,
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
    marginTop: 4,
  },
  genderContainer: {
    gap: 8,
  },
  genderButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  genderButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  genderButtonTextSelected: {
    color: '#fff',
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
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
