/**
 * Migration script to add profile_photo_url column to users table
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

async function addProfilePhotoColumn() {
  console.log('\nAdding profile_photo_url column to users table...\n');

  try {
    // Execute SQL to add the column
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
      `
    });

    if (error) {
      // If RPC doesn't exist, try direct query (may not work with service role)
      console.log('Note: You may need to run this SQL manually in Supabase SQL Editor:');
      console.log('');
      console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;');
      console.log('');
      throw error;
    }

    console.log('✅ Column added successfully!');
    console.log('');
    console.log('The users table now has a profile_photo_url column for DD profile photos.');
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\nPlease run this SQL manually in the Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;');
    console.log('');
  }
}

// Run the migration
addProfilePhotoColumn()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
