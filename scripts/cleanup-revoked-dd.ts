/**
 * Cleanup script to remove assignments and reject pending requests for revoked DDs
 * Run this once to fix the current database state
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupRevokedDDs() {
  console.log('Starting cleanup of revoked DD assignments and requests...\n');

  try {
    // 1. Find all users with revoked DD status
    const { data: revokedUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('dd_status', 'revoked');

    if (usersError) throw usersError;

    if (!revokedUsers || revokedUsers.length === 0) {
      console.log('No revoked DDs found.');
      return;
    }

    console.log(`Found ${revokedUsers.length} revoked DD(s):\n`);
    revokedUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email})`);
    });
    console.log('');

    const revokedUserIds = revokedUsers.map(u => u.id);

    // 2. Delete all DD assignments for revoked users (except those already marked as revoked)
    const { data: deletedAssignments, error: assignmentsError } = await supabase
      .from('dd_assignments')
      .delete()
      .in('user_id', revokedUserIds)
      .neq('status', 'revoked')
      .select();

    if (assignmentsError) throw assignmentsError;

    console.log(`Deleted ${deletedAssignments?.length || 0} active assignment(s) for revoked DDs`);

    // 3. Reject all pending DD requests for revoked users
    const { data: rejectedRequests, error: requestsError } = await supabase
      .from('dd_requests')
      .update({ status: 'rejected' })
      .in('user_id', revokedUserIds)
      .eq('status', 'pending')
      .select();

    if (requestsError) throw requestsError;

    console.log(`Rejected ${rejectedRequests?.length || 0} pending request(s) for revoked DDs`);

    // 4. End any active DD sessions for revoked users
    const { data: endedSessions, error: sessionsError } = await supabase
      .from('dd_sessions')
      .update({ 
        ended_at: new Date().toISOString(),
        is_active: false 
      })
      .in('user_id', revokedUserIds)
      .eq('is_active', true)
      .select();

    if (sessionsError) throw sessionsError;

    console.log(`Ended ${endedSessions?.length || 0} active session(s) for revoked DDs`);

    console.log('\n✅ Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupRevokedDDs()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
