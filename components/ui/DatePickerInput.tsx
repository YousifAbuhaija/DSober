import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';

interface Props {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function DatePickerInput({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  error,
  hint,
  containerStyle,
}: Props) {
  const [open, setOpen] = useState(false);

  const borderColor = error ? colors.ui.error : open ? colors.border.strong : colors.border.default;

  const handleChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (selected) onChange(selected);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.field, { borderColor }]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.75}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formatDate(value) : 'Select date'}
        </Text>
        <Ionicons
          name={open ? 'calendar' : 'calendar-outline'}
          size={18}
          color={open ? colors.brand.primary : colors.text.tertiary}
        />
      </TouchableOpacity>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      {open && (
        <DateTimePicker
          value={value ?? maximumDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          themeVariant="dark"
          style={styles.picker}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.input,
    borderRadius: radii.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    minHeight: 56,
  },
  value: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  placeholder: {
    color: colors.text.tertiary,
  },
  error: {
    fontSize: 13,
    color: colors.ui.error,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  picker: {
    marginTop: spacing.sm,
    backgroundColor: colors.bg.input,
    borderRadius: radii.md,
  },
});
