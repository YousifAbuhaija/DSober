// Script to test event status transitions
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testEventStatusTransition() {
  try {
    console.log('Testing event status transitions...\n');
    
    // Get all events
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('date_time', { ascending: true });
    
    if (error) {
      console.error('Error fetching events:', error);
      process.exit(1);
    }
    
    console.log(`Found ${events.length} events:\n`);
    
    const now = new Date();
    
    events.forEach(event => {
      const eventDate = new Date(event.date_time);
      const isPast = eventDate < now;
      const status = event.status;
      
      console.log(`Event: ${event.name}`);
      console.log(`  Date: ${eventDate.toLocaleString()}`);
      console.log(`  Current Status: ${status}`);
      console.log(`  Is Past: ${isPast}`);
      console.log(`  Should be: ${isPast ? 'active' : 'upcoming'}`);
      
      if (isPast && status === 'upcoming') {
        console.log(`  ⚠️  This event should be auto-transitioned to 'active'`);
      } else if (status === 'completed') {
        console.log(`  ✓ Event is completed (manual admin action)`);
      } else {
        console.log(`  ✓ Status is correct`);
      }
      
      console.log('');
    });
    
    console.log('\nTo test auto-transition:');
    console.log('1. Open the app and navigate to Events or DDs tab');
    console.log('2. Any upcoming events with past dates will automatically transition to "active"');
    console.log('3. Admins can manually mark events as "completed" from the event detail screen');
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

testEventStatusTransition();
