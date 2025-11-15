# Database Migration Instructions

⚠️ **IMPORTANT**: You need to run migration #3 (ride_requests table) in your Supabase SQL Editor for the Rides feature to work!

## Required SQL to Run in Supabase SQL Editor

Run these SQL statements in order in your Supabase SQL Editor:

**To access the SQL Editor:**
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste the SQL from each section below
5. Click "Run" to execute

### 1. Allow users to update their own DD assignments (from earlier fix)
```sql
-- Drop the policy if it exists, then create it
DROP POLICY IF EXISTS "Users can update their own DD assignments" ON dd_assignments;

CREATE POLICY "Users can update their own DD assignments"
  ON dd_assignments FOR UPDATE
  USING (user_id = auth.uid());
```

### 2. Add dd_status field for global DD revocation
```sql
-- Add the dd_status column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS dd_status TEXT NOT NULL DEFAULT 'none' 
CHECK (dd_status IN ('none', 'active', 'revoked'));

-- Update existing users based on their is_dd status
UPDATE users 
SET dd_status = CASE 
  WHEN is_dd = true THEN 'active'
  ELSE 'none'
END
WHERE dd_status = 'none';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_dd_status ON users(dd_status);
```

### 3. Add ride_requests table for ride coordination feature
```sql
-- IMPORTANT: If you already ran migration 013 with the old constraint, run this first:
ALTER TABLE ride_requests DROP CONSTRAINT IF EXISTS unique_active_request_per_event;
```

Then run:
```sql
-- Add ride_requests table for ride coordination feature
-- This migration creates the ride_requests table with RLS policies

-- ============================================================================
-- RIDE REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dd_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pickup_location_text TEXT NOT NULL,
  pickup_latitude NUMERIC,
  pickup_longitude NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ride_requests_dd_user_id ON ride_requests(dd_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_rider_user_id ON ride_requests(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_event_id ON ride_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_created_at ON ride_requests(created_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;

-- Riders can create their own ride requests
CREATE POLICY "Riders can create their own ride requests"
  ON ride_requests
  FOR INSERT
  WITH CHECK (auth.uid() = rider_user_id);

-- Riders can read their own ride requests
CREATE POLICY "Riders can read their own ride requests"
  ON ride_requests
  FOR SELECT
  USING (auth.uid() = rider_user_id);

-- Riders can update their own ride requests (for cancellation)
CREATE POLICY "Riders can update their own ride requests"
  ON ride_requests
  FOR UPDATE
  USING (auth.uid() = rider_user_id)
  WITH CHECK (auth.uid() = rider_user_id);

-- DDs can read ride requests assigned to them or pending requests for their active sessions
CREATE POLICY "DDs can read ride requests for their sessions"
  ON ride_requests
  FOR SELECT
  USING (
    auth.uid() = dd_user_id OR
    (status = 'pending' AND event_id IN (
      SELECT event_id FROM dd_sessions 
      WHERE user_id = auth.uid() AND is_active = true
    ))
  );

-- DDs can update ride requests assigned to them (accept, mark picked up, complete)
CREATE POLICY "DDs can update their assigned ride requests"
  ON ride_requests
  FOR UPDATE
  USING (auth.uid() = dd_user_id)
  WITH CHECK (auth.uid() = dd_user_id);

-- Admins can read all ride requests for events in their group
CREATE POLICY "Admins can read ride requests in their group"
  ON ride_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN events e ON e.id = ride_requests.event_id
      WHERE u.id = auth.uid() 
        AND u.role = 'admin' 
        AND u.group_id = e.group_id
    )
  );
```

## What Changed

### Global DD Revocation System

**Before:**
- DD revocation was per-event
- User could fail SEP for one event but still be assigned to others
- User could still request to be DD for other events

**After:**
- DD revocation is global across all events
- When a user fails SEP verification:
  1. Their `dd_status` is set to 'revoked' in the users table
  2. ALL their DD assignments across all events are revoked
  3. They cannot request to be DD for any events
  4. They see a message: "Your DD privileges have been revoked"
  5. An admin must reinstate them to regain DD privileges

### New Database Field

- `users.dd_status`: Enum with values:
  - `'none'`: User is not a DD
  - `'active'`: User is an active DD
  - `'revoked'`: User's DD privileges have been globally revoked

### Code Changes

1. **SEPResultScreen.tsx**: On SEP failure, now:
   - Updates user's `dd_status` to 'revoked'
   - Revokes ALL DD assignments (not just current event)
   - Creates admin alert for the specific event

2. **EventDetailScreen.tsx**: Now checks `user.ddStatus`:
   - Shows revoked message if `ddStatus === 'revoked'`
   - Prevents DD requests when globally revoked

3. **AuthContext.tsx**: Fetches and includes `ddStatus` in user object

4. **DDInterestScreen.tsx**: Sets `dd_status` to 'active' when user opts in as DD

5. **database.types.ts**: Added `ddStatus` field to User interface

## Testing

After running the SQL:

1. Have a DD user fail SEP verification
2. Verify they see "Your DD privileges have been revoked" message
3. Verify they cannot request to be DD for any events
4. Verify all their assignments show as 'revoked' in the database
5. Admin can later reinstate by updating `dd_status` back to 'active'

## Admin Reinstatement (Future Feature)

To reinstate a revoked DD, an admin would run:
```sql
UPDATE users 
SET dd_status = 'active' 
WHERE id = '<user_id>';

-- Optionally restore specific assignments
UPDATE dd_assignments 
SET status = 'assigned' 
WHERE user_id = '<user_id>' AND event_id = '<event_id>';
```

This functionality should be added to the Admin Dashboard in a future task.
