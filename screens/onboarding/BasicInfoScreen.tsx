import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StepProgress from '../../components/ui/StepProgress';
import { colors, spacing, typography, radii } from '../../theme';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const TOTAL_STEPS = 8;

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function parseBirthday(text: string): Date | null {
  const parts = text.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  return new Date(year, month, day);
}

function formatBirthday(text: string): string {
  const c = text.replace(/\D/g, '');
  if (c.length >= 4) return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`;
  if (c.length >= 2) return `${c.slice(0, 2)}/${c.slice(2)}`;
  return c;
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

function isValidPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 || (d.length === 11 && d[0] === '1');
}

export default function BasicInfoScreen({ navigation }: any) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const birthdayRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const clearError = (field: string) =>
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Full name is required';
    if (!birthday.trim()) {
      next.birthday = 'Birthday is required';
    } else {
      const d = parseBirthday(birthday);
      if (!d) next.birthday = 'Enter a valid date (MM/DD/YYYY)';
      else if (calculateAge(d) < 18) next.birthday = 'You must be at least 18 years old';
    }
    if (!gender) next.gender = 'Please select your gender';
    if (!phone.trim()) next.phone = 'Phone number is required';
    else if (!isValidPhone(phone)) next.phone = 'Enter a valid 10-digit US phone number';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const d = parseBirthday(birthday)!;
      await supabase.from('users').upsert({
        id: session!.user.id,
        email: session!.user.email || '',
        name: name.trim(),
        birthday: d.toISOString(),
        age: calculateAge(d),
        gender,
        phone_number: formatPhone(phone),
        role: 'member',
        is_dd: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      navigation.navigate('GroupJoin');
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Failed to save. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper keyboard scroll>
      <View style={styles.container}>
        <StepProgress current={0} total={TOTAL_STEPS} label="Basic Info" />

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Tell us about yourself</Text>
          <Text style={styles.subtitle}>This information helps your chapter identify you.</Text>
        </View>

        <Input
          label="Full Name"
          value={name}
          onChangeText={(v) => { setName(v); clearError('name'); }}
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => birthdayRef.current?.focus()}
        />

        <Input
          ref={birthdayRef}
          label="Birthday"
          value={birthday}
          onChangeText={(v) => { setBirthday(formatBirthday(v)); clearError('birthday'); }}
          error={errors.birthday}
          hint="MM/DD/YYYY — must be 18+"
          keyboardType="numeric"
          maxLength={10}
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />

        <View style={styles.genderBlock}>
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.genderGrid}>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.genderOption, gender === opt && styles.genderOptionActive]}
                onPress={() => { setGender(opt); clearError('gender'); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.genderText, gender === opt && styles.genderTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
        </View>

        <Input
          ref={phoneRef}
          label="Phone Number"
          value={phone}
          onChangeText={(v) => { setPhone(v); clearError('phone'); }}
          error={errors.phone}
          hint="Allows DDs and riders to coordinate pickups"
          keyboardType="phone-pad"
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={handleNext}
        />

        {errors.submit && <Text style={styles.errorText}>{errors.submit}</Text>}

        <Button
          onPress={handleNext}
          label="Continue"
          loading={loading}
          fullWidth
          size="lg"
          style={styles.cta}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  headingBlock: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.callout,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  genderBlock: {
    marginBottom: spacing.base,
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genderOption: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
  },
  genderOptionActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.faint,
  },
  genderText: {
    ...typography.callout,
    color: colors.text.secondary,
  },
  genderTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  errorText: {
    ...typography.caption,
    color: colors.ui.error,
    marginTop: spacing.xs,
  },
  cta: {
    marginTop: spacing.lg,
  },
});
