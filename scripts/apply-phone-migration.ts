import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log(`\n📄 Applying migration: Add phone_number column to users table`);
  
  const sql = `
-- Add phone_number column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
  `.trim();
  
  try {
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      const { error } = await supabase.rpc('exec_sql', { sql_string: statement + ';' });
      
      if (error) {
        console.error('❌ Error applying migration:', error);
        console.error('\n💡 You may need to apply this migration manually in the Supabase SQL Editor:');
        if (supabaseUrl) {
          console.error(`   ${supabaseUrl.replace('/rest/v1', '')}/project/default/sql`);
        }
        console.error('\n📋 SQL to run:');
        console.error(sql);
        process.exit(1);
      }
    }
    
    console.log('✅ Migration applied successfully');
  } catch (err) {
    console.error('❌ Error:', err);
    console.error('\n💡 Please apply this migration manually in the Supabase SQL Editor:');
    if (supabaseUrl) {
      console.error(`   ${supabaseUrl.replace('/rest/v1', '')}/project/default/sql`);
    }
    console.error('\n📋 SQL to run:');
    console.error(sql);
    process.exit(1);
  }
}

// Apply the migration
applyMigration();
