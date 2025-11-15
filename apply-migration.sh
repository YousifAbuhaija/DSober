#!/bin/bash

# Apply migration 004 to allow users to update their own DD assignments

source .env

curl -X POST "https://hdkvgrpshgswdgsqihpp.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE POLICY IF NOT EXISTS \"Users can update their own DD assignments\" ON dd_assignments FOR UPDATE USING (user_id = auth.uid());"
  }'

echo "Migration applied successfully!"
