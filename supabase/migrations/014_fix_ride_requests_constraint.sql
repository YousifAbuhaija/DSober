-- Fix ride_requests unique constraint to allow multiple cancelled/completed requests
-- The original constraint prevented users from having multiple requests with the same status,
-- but we want to allow multiple cancelled/completed requests while preventing multiple active ones

-- Drop the problematic constraint
ALTER TABLE ride_requests 
DROP CONSTRAINT IF EXISTS unique_active_request_per_event;

-- Create a partial unique index that only applies to active statuses
-- This allows multiple cancelled/completed requests but only one active request per rider per event
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_ride_request 
ON ride_requests (rider_user_id, event_id) 
WHERE status IN ('pending', 'accepted', 'picked_up');
