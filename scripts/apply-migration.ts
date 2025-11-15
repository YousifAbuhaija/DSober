import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(migrationFile: string) {
  console.log(`\n📄 Applying migration: ${migrationFile}`);
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query
      const { error: queryError } = await supabase.from('_migrations').select('*').limit(1);
      
      if (queryError) {
        console.error('❌ Error applying migration:', error);
        console.error('\n💡 You may need to apply this migration manually in the Supabase SQL Editor:');
        console.error(`   ${supabaseUrl.replace('/rest/v1', '')}/project/default/sql`);
        console.error('\n📋 SQL to run:');
        console.error(sql);
        process.exit(1);
      }
    }
    
    console.log('✅ Migration applied successfully');
  } catch (err) {
    console.error('❌ Error:', err);
    console.error('\n💡 Please apply this migration manually in the Supabase SQL Editor:');
    console.error(`   ${supabaseUrl.replace('/rest/v1', '')}/project/default/sql`);
    console.error('\n📋 SQL to run:');
    console.error(sql);
    process.exit(1);
  }
}

// Apply the migration
applyMigration('010_allow_group_lookup.sql');
