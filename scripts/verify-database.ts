/**
 * Database Verification Script
 * Run this script to verify that your Supabase database is properly set up
 * 
 * Usage: npx ts-node scripts/verify-database.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const REQUIRED_TABLES = [
  'groups',
  'users',
  'events',
  'dd_requests',
  'dd_assignments',
  'sep_baselines',
  'sep_attempts',
  'dd_sessions',
  'admin_alerts'
];

const REQUIRED_BUCKETS = [
  'license-photos',
  'sep-selfies',
  'sep-audio'
];

async function verifyTables() {
  console.log('\n🔍 Checking database tables...\n');
  
  let allTablesExist = true;
  
  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error) {
        console.error(`❌ Table '${table}' - Error: ${error.message}`);
        allTablesExist = false;
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    } catch (err) {
      console.error(`❌ Table '${table}' - Unexpected error`);
      allTablesExist = false;
    }
  }
  
  return allTablesExist;
}

async function verifyStorageBuckets() {
  console.log('\n🔍 Checking storage buckets...\n');
  
  let allBucketsExist = true;
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error(`❌ Error listing buckets: ${error.message}`);
      return false;
    }
    
    const bucketNames = buckets?.map(b => b.name) || [];
    
    for (const bucket of REQUIRED_BUCKETS) {
      if (bucketNames.includes(bucket)) {
        console.log(`✅ Bucket '${bucket}' exists`);
      } else {
        console.error(`❌ Bucket '${bucket}' not found`);
        allBucketsExist = false;
      }
    }
  } catch (err) {
    console.error('❌ Unexpected error checking buckets');
    allBucketsExist = false;
  }
  
  return allBucketsExist;
}

async function verifySeedData() {
  console.log('\n🔍 Checking seed data...\n');
  
  try {
    const { data: groups, error } = await supabase
      .from('groups')
      .select('name, access_code');
    
    if (error) {
      console.error(`❌ Error fetching groups: ${error.message}`);
      return false;
    }
    
    if (!groups || groups.length === 0) {
      console.warn('⚠️  No groups found - seed data may not be loaded');
      return false;
    }
    
    console.log(`✅ Found ${groups.length} group(s):`);
    groups.forEach(group => {
      console.log(`   - ${group.name} (Code: ${group.access_code})`);
    });
    
    return true;
  } catch (err) {
    console.error('❌ Unexpected error checking seed data');
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DSober Database Verification');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n📡 Connecting to: ${supabaseUrl}\n`);
  
  const tablesOk = await verifyTables();
  const bucketsOk = await verifyStorageBuckets();
  const seedDataOk = await verifySeedData();
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log(`Tables:       ${tablesOk ? '✅ All present' : '❌ Some missing'}`);
  console.log(`Buckets:      ${bucketsOk ? '✅ All present' : '⚠️  Cannot verify (check dashboard)'}`);
  console.log(`Seed Data:    ${seedDataOk ? '✅ Loaded' : '⚠️  Not loaded'}`);
  
  if (tablesOk && seedDataOk) {
    console.log('\n✅ Database setup is complete!');
    if (!bucketsOk) {
      console.log('\n⚠️  Note: Storage buckets could not be verified via API.');
      console.log('   Please verify manually in Supabase Dashboard → Storage');
      console.log('   Required buckets: license-photos, sep-selfies, sep-audio');
    }
    console.log('\nNext steps:');
    console.log('1. Test authentication by signing up a new user');
    console.log('2. Use an access code to join a group (ABG2024, DEZ2024, or TKL2024)');
    console.log('3. Continue with the implementation tasks');
    process.exit(0);
  } else {
    console.log('\n❌ Database setup is incomplete');
    console.log('\nPlease complete:');
    if (!tablesOk) console.log('- Run migrations to create tables');
    if (!seedDataOk) console.log('- Run migrations/004_seed_data.sql to add test groups');
    if (!bucketsOk) console.log('- Verify storage buckets exist in dashboard');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
