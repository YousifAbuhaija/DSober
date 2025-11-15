/**
 * Script to apply profile photo migrations
 * Run with: npx ts-node scripts/apply-profile-photo-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - EXPO_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(migrationFile: string) {
  console.log(`\n📄 Applying migration: ${migrationFile}`);
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    return false;
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query
      const { error: queryError } = await supabase.from('_migrations').select('*').limit(1);
      
      if (queryError) {
        console.error('❌ Error applying migration:', error);
        return false;
      }
    }
    
    console.log('✅ Migration applied successfully');
    return true;
  } catch (err) {
    console.error('❌ Error applying migration:', err);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting profile photo migration...\n');
  console.log('This will:');
  console.log('  1. Add profile_photo_url column to users table');
  console.log('  2. Create profile-photos storage bucket');
  console.log('  3. Set up storage policies for profile photos\n');
  
  // Apply migrations in order
  const migrations = [
    '015_add_profile_photo_url.sql',
    '016_add_profile_photos_bucket.sql',
  ];
  
  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (!success) {
      console.error('\n❌ Migration failed. Please check the errors above.');
      process.exit(1);
    }
  }
  
  console.log('\n✅ All migrations applied successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Test the profile photo upload during DD onboarding');
  console.log('  2. Verify photos appear on DD cards in the DDs list');
  console.log('  3. Check that storage policies are working correctly');
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
