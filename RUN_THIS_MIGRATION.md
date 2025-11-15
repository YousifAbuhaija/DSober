# 🚨 URGENT: Run This Migration to Fix Rides Feature

## The Problem
You're seeing this error:
```
Could not find the table 'public.ride_requests' in the schema cache
```

## The Solution
You need to run a SQL migration in your Supabase dashboard.

## Steps (5 minutes)

### 1. Open Supabase SQL Editor
- Go to https://supabase.com/dashboard
- Select your DSober project
- Click **"SQL Editor"** in the left sidebar
- Click **"New query"**

### 2. Copy the SQL

**IMPORTANT:** If you already ran the migration before and are getting constraint errors, run this first:
```sql
ALTER TABLE ride_requests DROP CONSTRAINT IF EXISTS unique_active_request_per_event;
```

Then run the main migration:

Open this file: `supabase/migrations/013_add_ride_requests.sql`

Or copy this SQL directly:

```sql
-- Add ride_requests table for ride coordination feature
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

-- Create indexes (including partial unique index for active requests)
CREATE INDEX IF NOT EXISTS idx_ride_requests_dd_user_id ON ride_requests(dd_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_rider_user_id ON ride_requests(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_event_id ON ride_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_created_at ON ride_requests(created_at);

-- Partial unique index: only one active request per rider per event
-- Allows multiple cancelled/completed requests
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_ride_request 
ON ride_requests (rider_user_id, event_id) 
WHERE status IN ('pending', 'accepted', 'picked_up');

-- Enable RLS
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;

-- Riders can create their own ride requests
CREATE POLICY "Riders can create their own ride requests"
  ON ride_requests FOR INSERT
  WITH CHECK (auth.uid() = rider_user_id);

-- Riders can read their own ride requests
CREATE POLICY "Riders can read their own ride requests"
  ON ride_requests FOR SELECT
  USING (auth.uid() = rider_user_id);

-- Riders can update their own ride requests
CREATE POLICY "Riders can update their own ride requests"
  ON ride_requests FOR UPDATE
  USING (auth.uid() = rider_user_id)
  WITH CHECK (auth.uid() = rider_user_id);

-- DDs can read ride requests for their sessions
CREATE POLICY "DDs can read ride requests for their sessions"
  ON ride_requests FOR SELECT
  USING (
    auth.uid() = dd_user_id OR
    (status = 'pending' AND event_id IN (
      SELECT event_id FROM dd_sessions 
      WHERE user_id = auth.uid() AND is_active = true
    ))
  );

-- DDs can update their assigned ride requests
CREATE POLICY "DDs can update their assigned ride requests"
  ON ride_requests FOR UPDATE
  USING (auth.uid() = dd_user_id)
  WITH CHECK (auth.uid() = dd_user_id);

-- Admins can read ride requests in their group
CREATE POLICY "Admins can read ride requests in their group"
  ON ride_requests FOR SELECT
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

### 3. Run the SQL
- Paste the SQL into the editor
- Click **"Run"** (or press Cmd/Ctrl + Enter)
- Wait for "Success" message

### 4. Refresh Your App
- Close and reopen the DSober app
- The Rides tab should now work!

## What This Does
Creates the `ride_requests` table that stores:
- Ride requests from riders to DDs
- Pickup locations
- Request status (pending, accepted, picked_up, completed, cancelled)
- Timestamps for tracking

## Need Help?
See `MIGRATION_INSTRUCTIONS.md` for more detailed instructions.
