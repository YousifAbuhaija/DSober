/**
 * Script to delete a specific DD request by ID
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

async function deleteRequest(requestId: string) {
  console.log(`\nDeleting DD request: ${requestId}\n`);

  try {
    const { data, error } = await supabase
      .from('dd_requests')
      .delete()
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Request deleted successfully');
    console.log(`   User ID: ${data.user_id}`);
    console.log(`   Event ID: ${data.event_id}`);
    console.log(`   Status: ${data.status}`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get request ID from command line arguments
const requestId = process.argv[2];

if (!requestId) {
  console.error('Usage: npm run delete-request <request-id>');
  process.exit(1);
}

// Run the deletion
deleteRequest(requestId)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
