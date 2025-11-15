// Utility functions for managing event status transitions

import { supabase } from '../lib/supabase';

/**
 * Check if an event should be automatically transitioned to 'active' status
 * Events become active when their dateTime has passed
 */
export async function updateEventStatusesToActive(groupId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    // Update all upcoming events whose dateTime has passed to 'active'
    const { error } = await supabase
      .from('events')
      .update({ status: 'active' })
      .eq('group_id', groupId)
      .eq('status', 'upcoming')
      .lt('date_time', now);
    
    if (error) {
      console.error('Error updating event statuses:', error);
    }
  } catch (error) {
    console.error('Error in updateEventStatusesToActive:', error);
  }
}

/**
 * Manually mark an event as completed (admin action)
 */
export async function markEventAsCompleted(eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('events')
      .update({ status: 'completed' })
      .eq('id', eventId);
    
    if (error) {
      console.error('Error marking event as completed:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in markEventAsCompleted:', error);
    return { success: false, error: 'Failed to mark event as completed' };
  }
}

/**
 * Get the display-friendly status text
 */
export function getEventStatusDisplay(status: string): string {
  switch (status) {
    case 'upcoming':
      return 'Upcoming';
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

/**
 * Get the status color for UI display
 */
export function getEventStatusColor(status: string): string {
  switch (status) {
    case 'upcoming':
      return '#007AFF'; // Blue
    case 'active':
      return '#34C759'; // Green
    case 'completed':
      return '#8E8E93'; // Gray
    default:
      return '#8E8E93';
  }
}
