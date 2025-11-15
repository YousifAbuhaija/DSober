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
  completed_at TIMESTAMPTZ,
  -- Ensure a rider can only have one active request per event
  CONSTRAINT unique_active_request_per_event UNIQUE (rider_user_id, event_id, status)
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
