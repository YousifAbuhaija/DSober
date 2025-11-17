import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/colors';

type EventsStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
};

type NavigationProp = StackNavigationProp<EventsStackParamList, 'CreateEvent'>;

export default function CreateEventScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [locationText, setLocationText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form validation
  const [errors, setErrors] = useState({
    name: '',
    locationText: '',
  });

  // Focus states
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors = {
      name: '',
      locationText: '',
    };

    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Event name is required';
      isValid = false;
    }

    if (!locationText.trim()) {
      newErrors.locationText = 'Location is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleCreate = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user?.groupId || !user?.id) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase.from('events').insert({
        group_id: user.groupId,
        name: name.trim(),
        description: description.trim() || null,
        date_time: dateTime.toISOString(),
        location_text: locationText.trim(),
        status: 'upcoming',
        created_by_user_id: user.id,
      }).select().single();

      if (error) throw error;

      Alert.alert('Success', 'Event created successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDateTime = new Date(dateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setDateTime(newDateTime);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDateTime = new Date(dateTime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setDateTime(newDateTime);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>Event Name *</Text>
        <TextInput
          style={[
            styles.input,
            errors.name ? styles.inputError : null,
            focusedInput === 'name' ? styles.inputFocused : null,
          ]}
          placeholder="e.g., Friday Night Social"
          placeholderTextColor={theme.colors.text.tertiary}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          onFocus={() => setFocusedInput('name')}
          onBlur={() => setFocusedInput(null)}
          maxLength={100}
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            focusedInput === 'description' ? styles.inputFocused : null,
          ]}
          placeholder="Add event details (optional)"
          placeholderTextColor={theme.colors.text.tertiary}
          value={description}
          onChangeText={setDescription}
          onFocus={() => setFocusedInput('description')}
          onBlur={() => setFocusedInput(null)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Date & Time *</Text>
        
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateTimeIcon}>📅</Text>
            <Text style={styles.dateTimeText}>{formatDate(dateTime)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.dateTimeIcon}>🕐</Text>
            <Text style={styles.dateTimeText}>{formatTime(dateTime)}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={dateTime}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={dateTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Location *</Text>
        <TextInput
          style={[
            styles.input,
            errors.locationText ? styles.inputError : null,
            focusedInput === 'location' ? styles.inputFocused : null,
          ]}
          placeholder="e.g., Chapter House, 123 Main St"
          placeholderTextColor={theme.colors.text.tertiary}
          value={locationText}
          onChangeText={(text) => {
            setLocationText(text);
            if (errors.locationText) setErrors({ ...errors, locationText: '' });
          }}
          onFocus={() => setFocusedInput('location')}
          onBlur={() => setFocusedInput(null)}
          maxLength={200}
        />
        {errors.locationText ? (
          <Text style={styles.errorText}>{errors.locationText}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.createButton, creating && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color={theme.colors.text.onPrimary} />
        ) : (
          <Text style={styles.createButtonText}>Create Event</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        disabled={creating}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background.input,
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  inputFocused: {
    borderColor: theme.colors.border.focus,
  },
  inputError: {
    borderColor: theme.colors.border.error,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.functional.error,
    marginTop: 4,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.input,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  dateTimeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  dateTimeText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    flex: 1,
  },
  createButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginBottom: 12,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.onPrimary,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border.default,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
});
