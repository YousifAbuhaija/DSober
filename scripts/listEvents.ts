import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listEvents() {
  console.log('📋 Listing all events for Kappa Theta Pie...\n');

  try {
    // Get the Kappa Theta Pie group
    const { data: group } = await supabase
      .from('groups')
      .select('id, name')
      .eq('name', 'Kappa Theta Pie')
      .single();

    if (!group) {
      console.error('❌ Group not found');
      return;
    }

    // Get all events for this group
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('group_id', group.id)
      .order('date_time', { ascending: true });

    if (error) {
      console.error('❌ Error fetching events:', error);
      return;
    }

    console.log(`Found ${events?.length || 0} events:\n`);
    events?.forEach((event, index) => {
      const date = new Date(event.date_time);
      console.log(`${index + 1}. ${event.name}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Date: ${date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })}`);
      console.log(`   Location: ${event.location_text}`);
      if (event.description) {
        console.log(`   Description: ${event.description}`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listEvents()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
