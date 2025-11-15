/**
 * Script to check all DD requests for a specific user
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

async function checkUserRequests(email: string) {
  console.log(`\nChecking DD requests for: ${email}\n`);

  try {
    // Find the user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('❌ User not found');
      return;
    }

    console.log(`Found user: ${user.name} (ID: ${user.id})\n`);

    // Get all requests for this user
    const { data: requests, error: requestsError } = await supabase
      .from('dd_requests')
      .select(`
        *,
        events (name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (requestsError) throw requestsError;

    if (!requests || requests.length === 0) {
      console.log('No DD requests found for this user.');
      return;
    }

    console.log(`Found ${requests.length} request(s):\n`);
    requests.forEach((req, index) => {
      console.log(`${index + 1}. Event: ${req.events?.name || 'Unknown'}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Created: ${new Date(req.created_at).toLocaleString()}`);
      console.log(`   Request ID: ${req.id}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run check-requests <email>');
  process.exit(1);
}

// Run the check
checkUserRequests(email)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
