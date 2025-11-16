import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Group, SEPBaseline } from '../types/database.types';

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [sepBaseline, setSepBaseline] = useState<SEPBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit driver info state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editCarMake, setEditCarMake] = useState('');
  const [editCarModel, setEditCarModel] = useState('');
  const [editCarPlate, setEditCarPlate] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch group name and SEP baseline
  const fetchAdditionalData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch group name
      if (user.groupId) {
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('name')
          .eq('id', user.groupId)
          .single();

        if (!groupError && groupData) {
          setGroupName(groupData.name);
        }
      }

      // Fetch SEP baseline
      const { data: baselineData, error: baselineError } = await supabase
        .from('sep_baselines')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!baselineError && baselineData) {
        setSepBaseline({
          id: baselineData.id,
          userId: baselineData.user_id,
          reactionAvgMs: baselineData.reaction_avg_ms,
          phraseDurationSec: baselineData.phrase_duration_sec,
          selfieUrl: baselineData.selfie_url,
          createdAt: new Date(baselineData.created_at),
        });
      }
    } catch (error) {
      console.error('Error fetching additional data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh user data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refresh = async () => {
        await refreshUser();
        await fetchAdditionalData();
      };
      refresh();
    }, [user?.id])
  );

  const handleEditDriverInfo = () => {
    setEditCarMake(user?.carMake || '');
    setEditCarModel(user?.carModel || '');
    setEditCarPlate(user?.carPlate || '');
    setEditModalVisible(true);
  };

  const handleSaveDriverInfo = async () => {
    if (!user) return;

    // Validate required fields
    if (!editCarMake.trim() || !editCarModel.trim() || !editCarPlate.trim()) {
      Alert.alert('Validation Error', 'All fields are required.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          car_make: editCarMake.trim(),
          car_model: editCarModel.trim(),
          car_plate: editCarPlate.trim(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh user data
      await refreshUser();
      setEditModalVisible(false);
      Alert.alert('Success', 'Driver information updated successfully.');
    } catch (error) {
      console.error('Error updating driver info:', error);
      Alert.alert('Error', 'Failed to update driver information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  if (!user || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info Section */}
      <View style={styles.section}>
        <View style={styles.avatarContainer}>
          {user.profilePhotoUrl ? (
            <Image
              source={{ uri: user.profilePhotoUrl }}
              style={styles.avatarImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('Error loading profile photo:', error.nativeEvent.error);
              }}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>

      {/* Account Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        
        {groupName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Group</Text>
            <Text style={styles.infoValue}>{groupName}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <View style={[
            styles.roleBadge,
            { backgroundColor: user.role === 'admin' ? '#E8F5E9' : '#E3F2FD' }
          ]}>
            <Text style={[
              styles.roleBadgeText,
              { color: user.role === 'admin' ? '#2E7D32' : '#1565C0' }
            ]}>
              {user.role === 'admin' ? '🛡️ Admin' : '👤 Member'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>DD Status</Text>
          {user.isDD ? (
            <View style={[
              styles.statusBadge,
              { 
                backgroundColor: user.ddStatus === 'revoked' ? '#FFEBEE' : '#E8F5E9'
              }
            ]}>
              <Text style={[
                styles.statusBadgeText,
                { 
                  color: user.ddStatus === 'revoked' ? '#C62828' : '#2E7D32'
                }
              ]}>
                {user.ddStatus === 'revoked' ? '⚠️ Revoked' : '✓ Active DD'}
              </Text>
            </View>
          ) : (
            <Text style={styles.infoValue}>Not a DD</Text>
          )}
        </View>

        {user.isDD && (
          <>
            <View style={styles.divider} />
            <View style={styles.subsectionHeader}>
              <Text style={styles.subsectionTitle}>Driver Information</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditDriverInfo}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            
            {user.carMake && user.carModel && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vehicle</Text>
                <Text style={styles.infoValue}>
                  {user.carMake} {user.carModel}
                </Text>
              </View>
            )}
            
            {user.carPlate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>License Plate</Text>
                <Text style={styles.infoValue}>{user.carPlate}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* SEP Baseline Section */}
      {sepBaseline && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SEP Baseline</Text>
          <Text style={styles.sectionDescription}>
            Your baseline measurements from onboarding
          </Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reaction Time</Text>
            <Text style={styles.infoValue}>{sepBaseline.reactionAvgMs} ms</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phrase Duration</Text>
            <Text style={styles.infoValue}>{sepBaseline.phraseDurationSec.toFixed(2)} sec</Text>
          </View>
        </View>
      )}

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#FF3B30" />
        ) : (
          <Text style={styles.logoutButtonText}>Log Out</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.versionText}>DSober v1.0.0</Text>

      {/* Edit Driver Info Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Driver Information</Text>
            
            <Text style={styles.inputLabel}>Car Make</Text>
            <TextInput
              style={styles.input}
              value={editCarMake}
              onChangeText={setEditCarMake}
              placeholder="e.g., Toyota"
              placeholderTextColor="#8E8E93"
            />
            
            <Text style={styles.inputLabel}>Car Model</Text>
            <TextInput
              style={styles.input}
              value={editCarModel}
              onChangeText={setEditCarModel}
              placeholder="e.g., Camry"
              placeholderTextColor="#8E8E93"
            />
            
            <Text style={styles.inputLabel}>License Plate</Text>
            <TextInput
              style={styles.input}
              value={editCarPlate}
              onChangeText={setEditCarPlate}
              placeholder="e.g., ABC123"
              placeholderTextColor="#8E8E93"
              autoCapitalize="characters"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveDriverInfo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E5EA',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    marginTop: -8,
  },
  subsectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
    marginBottom: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  versionText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
