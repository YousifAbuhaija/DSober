/**
 * Test script for send-notification edge function
 * 
 * Usage:
 *   deno run --allow-net --allow-env test-send-notification.ts
 * 
 * Set these environment variables before running:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_ANON_KEY - Your Supabase anon key
 *   TEST_USER_ID - A test user ID with registered device
 *   TEST_GROUP_ID - A test group ID (optional, for group notifications)
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const TEST_USER_ID = Deno.env.get('TEST_USER_ID');
const TEST_GROUP_ID = Deno.env.get('TEST_GROUP_ID');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  Deno.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-notification`;

interface TestCase {
  name: string;
  payload: {
    type: string;
    userId?: string;
    groupId?: string;
    data: Record<string, any>;
  };
  skip?: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Ride Request Notification',
    payload: {
      type: 'ride_request',
      userId: TEST_USER_ID,
      data: {
        riderName: 'Test Rider',
        pickupLocation: '123 Test Street',
        rideRequestId: 'test-ride-123',
        eventId: 'test-event-123',
        sessionId: 'test-session-123',
      },
    },
    skip: !TEST_USER_ID,
  },
  {
    name: 'Ride Accepted Notification',
    payload: {
      type: 'ride_accepted',
      userId: TEST_USER_ID,
      data: {
        ddName: 'Test DD',
        carInfo: 'Blue Honda Civic',
        rideRequestId: 'test-ride-123',
        eventId: 'test-event-123',
        ddUserId: 'test-dd-123',
      },
    },
    skip: !TEST_USER_ID,
  },
  {
    name: 'SEP Failure Alert (Group)',
    payload: {
      type: 'sep_failure',
      groupId: TEST_GROUP_ID,
      data: {
        userName: 'Test User',
        eventName: 'Test Event',
        userId: 'test-user-123',
        eventId: 'test-event-123',
        alertId: 'test-alert-123',
      },
    },
    skip: !TEST_GROUP_ID,
  },
  {
    name: 'DD Request Approved',
    payload: {
      type: 'dd_request_approved',
      userId: TEST_USER_ID,
      data: {
        userId: TEST_USER_ID,
      },
    },
    skip: !TEST_USER_ID,
  },
  {
    name: 'Event Active Notification',
    payload: {
      type: 'event_active',
      userId: TEST_USER_ID,
      data: {
        eventName: 'Test Event',
        eventId: 'test-event-123',
      },
    },
    skip: !TEST_USER_ID,
  },
];

async function runTest(testCase: TestCase): Promise<void> {
  if (testCase.skip) {
    console.log(`⏭️  Skipping: ${testCase.name} (missing required env vars)`);
    return;
  }

  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   Payload:`, JSON.stringify(testCase.payload, null, 2));

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase.payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Success (${response.status})`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Failed (${response.status})`);
      console.log(`   Error:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Starting send-notification edge function tests\n');
  console.log(`Function URL: ${FUNCTION_URL}`);
  console.log(`Test User ID: ${TEST_USER_ID || 'Not set'}`);
  console.log(`Test Group ID: ${TEST_GROUP_ID || 'Not set'}`);

  for (const testCase of testCases) {
    await runTest(testCase);
  }

  console.log('\n✨ All tests completed\n');
}

// Run tests
runAllTests();
