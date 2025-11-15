/**
 * Script to promote a user to admin role
 * This updates the user's role to 'admin'
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

async function makeUserAdmin() {
  try {
    // Get user email
    const email = await question('Enter the email of the user to make admin: ');

    if (!email.trim()) {
      console.error('❌ Email is required');
      process.exit(1);
    }

    // Find user by email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name, role, group_id')
      .eq('email', email.trim())
      .single();

    if (fetchError || !user) {
      console.error('❌ User not found:', fetchError?.message || 'No user with that email');
      process.exit(1);
    }

    console.log('\n📋 Current user data:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Current Role: ${user.role}`);
    console.log(`   Group ID: ${user.group_id || '(not set)'}`);

    if (user.role === 'admin') {
      console.log('\n✅ User is already an admin!');
      process.exit(0);
    }

    const confirm = await question('\n⚠️  Promote this user to admin? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      process.exit(0);
    }

    // Update user role to admin
    const { error: updateError } = await supabase
      .from('users')
      .update({
        role: 'admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating user:', updateError.message);
      process.exit(1);
    }

    console.log('\n✅ User promoted to admin successfully!');
    console.log('   The user will now see the Admin tab when they log in.');
    console.log('   They can create events and manage DD requests.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

makeUserAdmin();
