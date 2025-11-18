# Edge Functions Deployment Guide

This guide covers deploying Supabase Edge Functions for the DSober application.

## Prerequisites

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link to Your Project**
   ```bash
   cd DSober
   supabase link --project-ref <your-project-ref>
   ```
   
   You can find your project ref in your Supabase dashboard URL:
   `https://app.supabase.com/project/<your-project-ref>`

## Deploying send-notification Function

### 1. Deploy the Function

```bash
supabase functions deploy send-notification
```

This will:
- Upload the function code to Supabase
- Make it available at: `https://<your-project-ref>.supabase.co/functions/v1/send-notification`

### 2. Verify Deployment

Check the function logs to ensure it deployed successfully:

```bash
supabase functions logs send-notification
```

### 3. Test the Function

#### Option A: Using the Test Script

Set environment variables:
```bash
export SUPABASE_URL="https://<your-project-ref>.supabase.co"
export SUPABASE_ANON_KEY="<your-anon-key>"
export TEST_USER_ID="<a-test-user-id>"
export TEST_GROUP_ID="<a-test-group-id>"
```

Run the test script:
```bash
cd supabase/functions/send-notification
deno run --allow-net --allow-env test-send-notification.ts
```

#### Option B: Using curl

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ride_request",
    "userId": "<user-id>",
    "data": {
      "riderName": "Test User",
      "pickupLocation": "Test Location",
      "rideRequestId": "test-123",
      "eventId": "event-123",
      "sessionId": "session-123"
    }
  }'
```

#### Option C: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Edge Functions
3. Select `send-notification`
4. Use the built-in test interface

## Environment Variables

The function automatically has access to:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

No additional environment variables need to be set.

## Monitoring

### View Logs

Real-time logs:
```bash
supabase functions logs send-notification --tail
```

Recent logs:
```bash
supabase functions logs send-notification --limit 100
```

### Check Function Status

```bash
supabase functions list
```

## Troubleshooting

### Function Not Found

If you get a 404 error:
1. Verify the function is deployed: `supabase functions list`
2. Check your project ref is correct
3. Ensure you're using the correct URL format

### Permission Errors

If you get permission errors:
1. Verify your anon key is correct
2. Check RLS policies on `user_devices`, `notifications`, and `notification_preferences` tables
3. Ensure the service role key is set correctly (automatic in Supabase)

### Expo Push API Errors

If notifications aren't sending:
1. Check function logs for Expo API errors
2. Verify device tokens are valid Expo push tokens
3. Ensure tokens are marked as `is_active = true` in `user_devices` table
4. Check that the Expo Push API is accessible from Supabase edge functions

### Database Errors

If you see database errors:
1. Verify all required tables exist (run migrations)
2. Check RLS policies allow the service role to access tables
3. Ensure foreign key constraints are satisfied

## Updating the Function

After making changes to the function code:

```bash
supabase functions deploy send-notification
```

The function will be updated immediately. No restart required.

## Rollback

If you need to rollback to a previous version:

1. Check function versions:
   ```bash
   supabase functions list --with-versions
   ```

2. Deploy a specific version:
   ```bash
   supabase functions deploy send-notification --version <version-id>
   ```

## Production Checklist

Before deploying to production:

- [ ] All database migrations are applied
- [ ] RLS policies are configured correctly
- [ ] Test with real device tokens
- [ ] Verify notification preferences work
- [ ] Test critical notifications bypass preferences
- [ ] Confirm invalid tokens are deactivated
- [ ] Check notification logging works
- [ ] Verify retry logic handles failures
- [ ] Test with multiple recipients
- [ ] Confirm group notifications work
- [ ] Monitor logs for errors
- [ ] Set up alerts for function failures

## Next Steps

After deploying the edge function:

1. **Create Database Triggers** (Task 8)
   - Triggers will automatically call this function when events occur
   - See `tasks.md` for trigger implementation tasks

2. **Test End-to-End Flow**
   - Create a ride request → DD receives notification
   - Accept ride → Rider receives notification
   - Fail SEP → Admins receive notification

3. **Monitor Performance**
   - Check notification delivery times
   - Monitor success/failure rates
   - Review logs for errors

## Support

For issues or questions:
- Check Supabase Edge Functions documentation: https://supabase.com/docs/guides/functions
- Review function logs for detailed error messages
- Test locally using Supabase CLI: `supabase functions serve`
