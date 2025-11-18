# Send Notification Edge Function

This Supabase Edge Function handles sending push notifications via the Expo Push API.

## Features

- **Recipient Resolution**: Sends to individual users or all admins in a group
- **Preference Filtering**: Respects user notification preferences (except critical notifications)
- **Template-Based**: Uses predefined templates for consistent notification formatting
- **Expo Push Integration**: Sends notifications via Expo Push API with batching
- **Retry Logic**: Automatically retries failed sends up to 3 times with exponential backoff
- **Notification Logging**: Records all notifications in the database for history
- **Token Management**: Automatically deactivates invalid device tokens

## Deployment

### Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link to your project:
```bash
cd DSober
supabase link --project-ref <your-project-ref>
```

### Deploy the Function

```bash
supabase functions deploy send-notification
```

### Set Environment Variables

The function requires the following environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Your Supabase project URL (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access (auto-set)

No additional environment variables are needed as the Expo Push API URL is hardcoded.

## Testing

### Test with curl

```bash
# Test ride request notification
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ride_request",
    "userId": "<user-id>",
    "data": {
      "riderName": "John Doe",
      "pickupLocation": "123 Main St",
      "rideRequestId": "<ride-request-id>",
      "eventId": "<event-id>",
      "sessionId": "<session-id>"
    }
  }'

# Test SEP failure notification (to all admins)
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sep_failure",
    "groupId": "<group-id>",
    "data": {
      "userName": "Jane Smith",
      "eventName": "Friday Night Event",
      "userId": "<user-id>",
      "eventId": "<event-id>",
      "alertId": "<alert-id>"
    }
  }'
```

### Test Script

A test script is provided in `test-send-notification.ts`. Run it with:

```bash
deno run --allow-net --allow-env test-send-notification.ts
```

## API Reference

### Request Body

```typescript
{
  type: string;           // Notification type (e.g., 'ride_request', 'sep_failure')
  userId?: string;        // Single recipient user ID
  groupId?: string;       // Send to all admins in this group
  data: {                 // Notification-specific data
    [key: string]: any;
  }
}
```

### Response

```typescript
{
  success: boolean;
  message: string;
  recipients: number;     // Number of users who received notification
  sent: number;          // Number of successfully sent notifications
  failed: number;        // Number of failed notifications
}
```

### Supported Notification Types

- `ride_request` - New ride request for DD
- `ride_accepted` - DD accepted ride
- `ride_picked_up` - DD picked up rider
- `ride_cancelled` - Ride was cancelled
- `sep_failure` - SEP verification failed (critical)
- `dd_revoked` - DD status revoked (critical)
- `dd_session_started` - DD session started
- `dd_session_reminder` - DD session reminder (4 hours)
- `dd_request_approved` - DD upgrade request approved
- `dd_request_rejected` - DD upgrade request rejected
- `event_active` - Event is now active
- `event_cancelled` - Event was cancelled
- `dd_assigned` - User assigned as DD for event

## Error Handling

The function handles various error scenarios:

1. **Invalid Request**: Returns 400 if type or recipient is missing
2. **No Recipients**: Returns 200 with sent=0 if no recipients found
3. **No Devices**: Returns 200 with sent=0 if no active devices
4. **Expo API Errors**: Retries up to 3 times with exponential backoff
5. **Invalid Tokens**: Automatically marks tokens as inactive in database

## Monitoring

Check function logs:
```bash
supabase functions logs send-notification
```

View recent invocations:
```bash
supabase functions logs send-notification --tail
```

## Database Integration

This function is typically called by database triggers:
- `notify_dd_on_ride_request` - When ride request is created
- `notify_rider_on_status_change` - When ride status changes
- `notify_admins_on_sep_failure` - When SEP verification fails
- And more...

See the migrations in `supabase/migrations/` for trigger implementations.
