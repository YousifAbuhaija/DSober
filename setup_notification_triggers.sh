#!/bin/bash

# Setup script for notification triggers
# Run this after applying migration 024

echo "Setting up notification triggers..."
echo ""

# Check if Supabase is running
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
    echo "❌ Supabase is not running locally"
    echo "Please start Supabase with: supabase start"
    exit 1
fi

echo "✓ Supabase is running"
echo ""

# Apply the simplified configuration
echo "Applying configuration..."
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/migrations/024_configure_notification_triggers_v2.sql

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Next steps:"
echo "1. Make sure the send-notification edge function is deployed"
echo "2. Test the triggers by creating a ride request or other event"
echo "3. Check the notifications table for created notifications"
echo ""
echo "To test locally:"
echo "  supabase functions serve send-notification"
echo ""

