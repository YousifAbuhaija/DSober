# Event Status Transitions

## Overview

Events now automatically transition from 'upcoming' to 'active' when their dateTime arrives, and admins can manually mark events as 'completed'.

## Implementation Details

### Automatic Transition: Upcoming → Active

**When it happens:**
- Automatically when users open the Events tab or DDs tab
- The system checks all 'upcoming' events and transitions any with past dateTime to 'active'

**How it works:**
- `utils/eventStatus.ts` contains the `updateEventStatusesToActive()` function
- This function is called in:
  - `EventsListScreen.tsx` - when fetching events
  - `DDsListScreen.tsx` - when fetching events for DD discovery

**Logic:**
```typescript
// Updates all upcoming events whose dateTime has passed to 'active'
UPDATE events 
SET status = 'active' 
WHERE group_id = ? 
  AND status = 'upcoming' 
  AND date_time < NOW()
```

### Manual Transition: Active/Upcoming → Completed

**Who can do it:**
- Only admins

**Where:**
- Event Detail Screen → Admin Actions section

**How it works:**
1. Admin opens an event detail screen
2. If event is not already 'completed', they see a "Mark as Completed" button
3. Clicking shows a confirmation dialog
4. Upon confirmation, the event status is updated to 'completed'
5. The event is refreshed to show the new status

**UI Features:**
- Button is disabled while processing
- Shows loading indicator during update
- Confirmation dialog prevents accidental completion
- Success/error alerts provide feedback

## Status Badge Colors

Events display colored status badges throughout the app:

- **Upcoming** (Blue #007AFF): Event hasn't started yet
- **Active** (Green #34C759): Event is currently happening
- **Completed** (Gray #8E8E93): Event is finished

## Files Modified

### New Files
- `utils/eventStatus.ts` - Event status utility functions

### Modified Files
- `screens/EventsListScreen.tsx` - Auto-update on load
- `screens/EventDetailScreen.tsx` - Admin "Mark as Completed" button
- `screens/DDsListScreen.tsx` - Auto-update on load

## Testing

### Test Auto-Transition
1. Create an event with a past date/time
2. Set its status to 'upcoming' in the database
3. Open the Events tab or DDs tab in the app
4. The event should automatically show as 'active'

### Test Manual Completion
1. Log in as an admin
2. Open any event that is 'upcoming' or 'active'
3. Scroll to Admin Actions section
4. Click "Mark as Completed"
5. Confirm the action
6. Event should now show as 'completed'

### Test Script
Run the test script to see current event statuses:
```bash
node scripts/test-event-status.js
```

## Future Enhancements

Potential improvements for the future:

1. **Scheduled Jobs**: Use a cron job or scheduled function to auto-transition events without requiring user interaction
2. **Auto-Complete**: Automatically mark events as completed X hours after their end time
3. **Event Duration**: Add an end time field to events for more precise status management
4. **Notifications**: Notify admins when events transition to active
5. **Bulk Actions**: Allow admins to mark multiple events as completed at once
6. **Status History**: Track when status changes occurred and by whom

## Notes

- Completed events are still visible in the events list (they're not filtered out)
- DD assignments and sessions remain associated with completed events
- The auto-transition only affects events in the user's group
- Status transitions are immediate and don't require app restart
