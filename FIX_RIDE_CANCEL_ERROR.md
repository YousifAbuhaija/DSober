# 🚨 Fix: Ride Cancellation Error

## The Problem
When trying to cancel a ride request, you get this error:
```
duplicate key value violates unique constraint "unique_active_request_per_event"
```

## Why This Happens
The original database constraint was incorrectly designed. It prevented users from having multiple requests with the same status, which means you couldn't cancel a request and then create a new one.

## The Fix (2 minutes)

### Option 1: Quick Fix (If you already ran migration 013)

Run this SQL in your Supabase SQL Editor:

```sql
-- Drop the bad constraint
ALTER TABLE ride_requests 
DROP CONSTRAINT IF EXISTS unique_active_request_per_event;

-- Add the correct partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_ride_request 
ON ride_requests (rider_user_id, event_id) 
WHERE status IN ('pending', 'accepted', 'picked_up');
```

### Option 2: Fresh Start (If you haven't created any ride requests yet)

1. Drop the table and recreate it:
```sql
DROP TABLE IF EXISTS ride_requests CASCADE;
```

2. Then run the updated migration from `supabase/migrations/013_add_ride_requests.sql`

## What Changed

**Before (Bad):**
- Constraint: `UNIQUE (rider_user_id, event_id, status)`
- Problem: Can't have multiple cancelled or completed requests

**After (Good):**
- Partial Index: `UNIQUE (rider_user_id, event_id) WHERE status IN ('pending', 'accepted', 'picked_up')`
- Benefit: Can have multiple cancelled/completed requests, but only one active request at a time

## Test It

After running the fix:
1. Request a ride
2. Cancel it
3. Request another ride from the same DD for the same event
4. Should work without errors! ✅

## Files Updated
- `supabase/migrations/013_add_ride_requests.sql` - Fixed for new installations
- `supabase/migrations/014_fix_ride_requests_constraint.sql` - Fix for existing installations
- `RUN_THIS_MIGRATION.md` - Updated with fix instructions
