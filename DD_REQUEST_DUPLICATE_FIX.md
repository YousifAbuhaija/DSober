# DD Request Duplicate Key Fix - Summary

## Problem
When a reinstated DD tried to request DD status for an event they previously had a request for, they got a duplicate key constraint error:
```
duplicate key value violates unique constraint "dd_requests_event_id_user_id_key"
```

This happened because:
1. Old approved/rejected requests weren't being cleaned up when DD was revoked
2. The database has a unique constraint on (event_id, user_id) to prevent duplicate requests
3. The insert operation failed because an old request still existed

## What Was Fixed

### 1. Updated Request Submission to Use Upsert

**EventDetailScreen.tsx - `requestToBeDD()` function**
- Changed from `insert()` to `upsert()` with conflict resolution
- Now updates existing requests instead of failing on duplicates
- Updates the `created_at` timestamp to reflect the new request time

### 2. Updated Request Fetching Logic

**EventDetailScreen.tsx - `fetchEventDetails()` function**
- Now only fetches pending or approved requests (ignores rejected)
- Rejected requests no longer block users from seeing the "Request to be DD" button
- Users can submit new requests even if they have old rejected requests

### 3. Enhanced SEP Failure Handling

**SEPResultScreen.tsx**
- Now rejects BOTH pending AND approved requests when DD is revoked
- Previously only rejected pending requests, leaving approved ones active
- Ensures complete cleanup when a DD fails verification

### 4. Immediate Fix Applied

Deleted the old approved request for haijayousif@gmail.com for "Friday Night Social" event:
- Request ID: 77a59bd5-1a99-487d-8869-a5d54c3cdb4e
- User can now submit a new request without constraint violations

## New Scripts Available

- `npm run check-requests <email>` - View all DD requests for a user
- `npm run delete-request <request-id>` - Delete a specific DD request
- `npm run cleanup-rejected` - Delete all rejected requests (cleanup)

## How It Works Now

### Scenario 1: User Submits New Request
1. User clicks "Request to be DD"
2. System uses upsert with conflict resolution
3. If old request exists → Updates it to pending
4. If no request exists → Creates new pending request
5. ✅ No duplicate key errors

### Scenario 2: DD Gets Revoked
1. DD fails SEP verification
2. System updates dd_status to 'revoked'
3. System revokes all assignments
4. System rejects all pending AND approved requests
5. System ends all active sessions
6. ✅ Complete cleanup

### Scenario 3: DD Gets Reinstated
1. Admin reinstates DD from admin dashboard
2. User's dd_status updated to 'active'
3. Old rejected requests are ignored in UI
4. User can submit new requests (upsert handles old records)
5. ✅ User can request DD again

## Testing

To verify the fix:
1. Reinstated DD navigates to event detail
2. Should see "Request to be DD" button (not blocked by old rejected requests)
3. Click "Request to be DD"
4. Should succeed without duplicate key errors
5. Request should appear as "pending" in admin dashboard

## Database Constraints

The `dd_requests` table has a unique constraint:
```sql
UNIQUE (event_id, user_id)
```

This prevents multiple active requests from the same user for the same event. The upsert approach respects this constraint while allowing request updates.
