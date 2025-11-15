import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface GroupJoinScreenProps {
  navigation: any;
}

export default function GroupJoinScreen({ navigation }: GroupJoinScreenProps) {
  const { session, refreshUser } = useAuth();
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinGroup = async () => {
    // Validate access code
    if (!accessCode.trim()) {
      Alert.alert('Error', 'Please enter an access code');
      return;
    }

    setLoading(true);

    try {
      if (!session?.user?.id) {
        throw new Error('No user session found');
      }

      // Query the Group table to validate the access code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('access_code', accessCode.trim().toUpperCase())
        .single();

      if (groupError || !group) {
        Alert.alert(
          'Invalid Code',
          'The access code you entered was not found. Please check with your chapter admin.'
        );
        setLoading(false);
        return;
      }

      // Update user's groupId
      const { error: updateError } = await supabase
        .from('users')
        .update({
          group_id: group.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      // Navigate to DD Interest screen
      // Note: We don't refresh user context here to avoid triggering
      // the profile completion check in RootNavigator
      navigation.navigate('DDInterest');
    } catch (error: any) {
      console.error('Error joining group:', error);
      Alert.alert('Error', error.message || 'Failed to join group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Join Your Chapter</Text>
          <Text style={styles.subtitle}>
            Enter the access code provided by your chapter admin
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Access Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter access code"
              value={accessCode}
              onChangeText={setAccessCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={styles.hint}>
              Access codes are case-insensitive
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.joinButton, loading && styles.joinButtonDisabled]}
            onPress={handleJoinGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.joinButtonText}>Join Chapter</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don't have an access code? Contact your chapter admin.
          </Text>
        </View>
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
  header: {
    marginBottom: 40,
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
  joinButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  joinButtonDisabled: {
    backgroundColor: '#ccc',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
