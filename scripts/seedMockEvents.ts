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

async function seedMockEvents() {
  console.log('🌱 Seeding mock events for Kappa Theta Pie...');

  try {
    // First, get the Kappa Theta Pie group ID
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, access_code')
      .eq('name', 'Kappa Theta Pie')
      .single();

    if (groupError || !group) {
      console.error('❌ Error: Kappa Theta Pie group not found');
      console.log('Available groups:');
      const { data: allGroups } = await supabase.from('groups').select('*');
      console.log(allGroups);
      return;
    }

    console.log(`✓ Found group: ${group.name} (ID: ${group.id})`);

    // Get any user from this group to use as createdByUserId
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('group_id', group.id)
      .limit(10);

    if (usersError || !users || users.length === 0) {
      console.error('❌ Error: No users found for Kappa Theta Pie');
      console.log('Please create a user for this group first.');
      return;
    }

    // Prefer admin user, but use any user if no admin exists
    const adminUser = users.find(u => u.role === 'admin') || users[0];
    console.log(`✓ Found user: ${adminUser.name} (${adminUser.email}) - Role: ${adminUser.role}`);

    // Create mock events
    const now = new Date();
    const mockEvents = [
      {
        group_id: group.id,
        name: 'Friday Night Social',
        description: 'End of week celebration at the house. DDs needed for safe rides home.',
        date_time: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        location_text: 'Kappa Theta Pie House, 123 Greek Row',
        status: 'upcoming',
        created_by_user_id: adminUser.id,
      },
      {
        group_id: group.id,
        name: 'Homecoming Game Tailgate',
        description: 'Pre-game tailgate party. Multiple DDs needed for transportation.',
        date_time: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
        location_text: 'Stadium Parking Lot C',
        status: 'upcoming',
        created_by_user_id: adminUser.id,
      },
      {
        group_id: group.id,
        name: 'Mixer with Delta Sigma',
        description: 'Joint social event with Delta Sigma sorority.',
        date_time: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
        location_text: 'The Venue Downtown, 456 Main St',
        status: 'upcoming',
        created_by_user_id: adminUser.id,
      },
      {
        group_id: group.id,
        name: 'Saturday Night Out',
        description: 'Downtown bar crawl. DDs will shuttle between locations.',
        date_time: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
        location_text: 'Starting at Murphy\'s Pub',
        status: 'upcoming',
        created_by_user_id: adminUser.id,
      },
      {
        group_id: group.id,
        name: 'Formal Dinner',
        description: 'Semi-formal chapter dinner and awards ceremony.',
        date_time: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
        location_text: 'Grand Hotel Ballroom',
        status: 'upcoming',
        created_by_user_id: adminUser.id,
      },
      {
        group_id: group.id,
        name: 'Last Week\'s Party',
        description: 'This event already happened.',
        date_time: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        location_text: 'Kappa Theta Pie House',
        status: 'completed',
        created_by_user_id: adminUser.id,
      },
    ];

    // Insert events
    const { data: insertedEvents, error: insertError } = await supabase
      .from('events')
      .insert(mockEvents)
      .select();

    if (insertError) {
      console.error('❌ Error inserting events:', insertError);
      return;
    }

    console.log(`✓ Successfully created ${insertedEvents?.length || 0} mock events:`);
    insertedEvents?.forEach((event) => {
      console.log(`  - ${event.name} (${event.status})`);
    });

    console.log('\n✅ Mock events seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding mock events:', error);
  }
}

// Run the seed function
seedMockEvents()
  .then(() => {
    console.log('\n🎉 Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
