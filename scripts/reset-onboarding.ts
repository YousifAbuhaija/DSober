/**
 * Script to reset a user's onboarding status for testing
 * This clears the group_id to force the user back into onboarding
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function resetUserOnboarding() {
  try {
    // Get user email
    const email = await question('Enter the email of the user to reset: ');

    if (!email.trim()) {
      console.error('❌ Email is required');
      process.exit(1);
    }

    // Find user by email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name, group_id, is_dd')
      .eq('email', email.trim())
      .single();

    if (fetchError || !user) {
      console.error('❌ User not found:', fetchError?.message || 'No user with that email');
      process.exit(1);
    }

    console.log('\n📋 Current user data:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Group ID: ${user.group_id || '(not set)'}`);
    console.log(`   Is DD: ${user.is_dd}`);

    const confirm = await question('\n⚠️  Reset this user to DD Interest step? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      process.exit(0);
    }

    // Reset user to DD Interest step (keep name and birthday, clear group_id)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        group_id: null,
        is_dd: false,
        car_make: null,
        car_model: null,
        car_plate: null,
        license_photo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error resetting user:', updateError.message);
      process.exit(1);
    }

    console.log('\n✅ User reset successfully!');
    console.log('   The user will now see the Group Join screen when they log in.');
    console.log('   They can proceed through: Group Join → DD Interest → Driver Info (if DD)');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

resetUserOnboarding();
