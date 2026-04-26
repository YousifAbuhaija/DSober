import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { colors, spacing, typography, radii } from '../theme';

type IssueType = 'ride' | 'safety' | 'bug' | 'other';

interface IssueTypeOption {
  type: IssueType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const ISSUE_TYPES: IssueTypeOption[] = [
  { type: 'ride', label: 'Ride Issue', icon: 'car-outline', description: 'DD no-show, behavior, or pickup problem' },
  { type: 'safety', label: 'Safety Concern', icon: 'warning-outline', description: 'Something felt unsafe at an event' },
  { type: 'bug', label: 'App Bug', icon: 'bug-outline', description: 'Something is broken or not working' },
  { type: 'other', label: 'Other', icon: 'help-circle-outline', description: 'Anything else you want to report' },
];

type RouteParams = { type?: IssueType };

export default function ReportIssueScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { user } = useAuth();

  const [selectedType, setSelectedType] = useState<IssueType>(route.params?.type ?? 'ride');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please describe the issue before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        user_id: user?.id,
        type: selectedType,
        description: description.trim(),
        user_email: user?.email,
        user_name: user?.name,
      });

      if (error) {
        // Fallback: open mailto if table doesn't exist yet
        const subject = encodeURIComponent(`DSober Report: ${selectedType}`);
        const body = encodeURIComponent(
          `Type: ${selectedType}\nUser: ${user?.name} (${user?.email})\n\n${description.trim()}`
        );
        await Linking.openURL(`mailto:support@dsober.app?subject=${subject}&body=${body}`);
      }

      Alert.alert(
        'Report Submitted',
        'Thank you for letting us know. Our team will review your report and follow up if needed.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Submission Failed', 'Could not submit your report. Please email support@dsober.app directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.subtitle}>
        Your report goes directly to chapter admins and the DSober support team.
      </Text>

      {/* Issue type */}
      <Text style={styles.fieldLabel}>Issue Type</Text>
      <View style={styles.typeGrid}>
        {ISSUE_TYPES.map((option) => {
          const selected = selectedType === option.type;
          return (
            <TouchableOpacity
              key={option.type}
              style={[styles.typeCard, selected && styles.typeCardSelected]}
              onPress={() => setSelectedType(option.type)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={option.icon}
                size={22}
                color={selected ? colors.brand.primary : colors.text.secondary}
                style={styles.typeIcon}
              />
              <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                {option.label}
              </Text>
              <Text style={styles.typeDesc}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Description */}
      <Text style={styles.fieldLabel}>Description</Text>
      <Input
        value={description}
        onChangeText={setDescription}
        placeholder="Describe what happened, when it occurred, and any relevant details…"
        multiline
        numberOfLines={6}
        style={styles.textAreaInput}
        containerStyle={styles.textAreaContainer}
      />

      {/* Auto-attached info */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} style={{ marginRight: spacing.sm }} />
        <Text style={styles.infoText}>
          Your name and email ({user?.email}) will be attached to this report so we can follow up.
        </Text>
      </View>

      <Button
        label="Submit Report"
        onPress={handleSubmit}
        loading={submitting}
        fullWidth
        style={styles.submitBtn}
      />

      <TouchableOpacity
        style={styles.emailFallback}
        onPress={() => Linking.openURL('mailto:support@dsober.app')}
        activeOpacity={0.7}
      >
        <Text style={styles.emailFallbackText}>Or email us directly at support@dsober.app</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  content: {
    padding: spacing.base,
    paddingBottom: 48,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },

  // Field label
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  typeCard: {
    width: '48%',
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    gap: 4,
  },
  typeCardSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.elevated,
  },
  typeIcon: {
    marginBottom: 2,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  typeLabelSelected: {
    color: colors.brand.primary,
  },
  typeDesc: {
    fontSize: 12,
    color: colors.text.tertiary,
    lineHeight: 16,
  },

  // Text area
  textAreaInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  textAreaContainer: {
    marginBottom: spacing.md,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.bg.elevated,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.tertiary,
    lineHeight: 18,
  },

  // Submit
  submitBtn: {
    marginBottom: spacing.md,
  },
  emailFallback: {
    alignItems: 'center',
    padding: spacing.md,
  },
  emailFallbackText: {
    fontSize: 13,
    color: colors.text.tertiary,
    textDecorationLine: 'underline',
  },
});
