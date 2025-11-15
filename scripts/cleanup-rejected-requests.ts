/**
 * Cleanup script to remove rejected DD requests
 * This allows users to submit new requests without constraint violations
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

async function cleanupRejectedRequests() {
  console.log('Starting cleanup of rejected DD requests...\n');

  try {
    // Delete all rejected DD requests
    const { data: deletedRequests, error } = await supabase
      .from('dd_requests')
      .delete()
      .eq('status', 'rejected')
      .select();

    if (error) throw error;

    console.log(`✅ Deleted ${deletedRequests?.length || 0} rejected request(s)`);

    if (deletedRequests && deletedRequests.length > 0) {
      console.log('\nDeleted requests:');
      deletedRequests.forEach((req) => {
        console.log(`  - User: ${req.user_id}, Event: ${req.event_id}`);
      });
    }

    console.log('\n✅ Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupRejectedRequests()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
