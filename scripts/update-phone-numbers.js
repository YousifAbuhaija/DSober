// Script to update all user phone numbers to test number
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updatePhoneNumbers() {
  try {
    console.log('Updating all user phone numbers to test number...');
    
    const testPhoneNumber = '+1 (571) 419-3903';
    
    // Update all users
    const { data, error } = await supabase
      .from('users')
      .update({ phone_number: testPhoneNumber })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all users
    
    if (error) {
      console.error('Error updating phone numbers:', error);
      process.exit(1);
    }
    
    console.log('✅ Successfully updated all user phone numbers to:', testPhoneNumber);
    
    // Verify the update
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, name, phone_number')
      .limit(10);
    
    if (fetchError) {
      console.error('Error fetching users:', fetchError);
    } else {
      console.log('\nSample of updated users:');
      users.forEach(user => {
        console.log(`- ${user.name}: ${user.phone_number}`);
      });
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

updatePhoneNumbers();
