/**
 * Script to manually reinstate a user's DD status
 * Usage: npm run reinstate-user <email>
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

async function reinstateUser(email: string) {
  console.log(`\nReinstating DD status for: ${email}\n`);

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

    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`Current dd_status: ${user.dd_status}\n`);

    if (user.dd_status === 'active') {
      console.log('✓ User is already active');
      return;
    }

    // Update user's dd_status to 'active'
    const { error: updateError } = await supabase
      .from('users')
      .update({ dd_status: 'active' })
      .eq('id', user.id);

    if (updateError) throw updateError;

    console.log('✅ User dd_status updated to "active"');

    // Resolve all unresolved alerts for this user
    const { data: alerts, error: alertsError } = await supabase
      .from('admin_alerts')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: user.id, // Using user's own ID as placeholder
      })
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .select();

    if (alertsError) {
      console.error('Warning: Error resolving alerts:', alertsError);
    } else {
      console.log(`✅ Resolved ${alerts?.length || 0} alert(s)`);
    }

    console.log('\n✅ Reinstatement completed successfully!');
    console.log('The user should now be able to request DD assignments again.');
  } catch (error) {
    console.error('❌ Error during reinstatement:', error);
    throw error;
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run reinstate-user <email>');
  process.exit(1);
}

// Run the reinstatement
reinstateUser(email)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
