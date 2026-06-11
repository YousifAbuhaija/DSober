/**
 * Supabase Edge Function: delete-account
 *
 * Permanently deletes the calling user's account: storage objects
 * (license photo, SEP selfies/audio, profile photo) first, then the
 * auth user — all public rows are removed via ON DELETE CASCADE.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const USER_BUCKETS = ['license-photos', 'sep-selfies', 'sep-audio', 'profile-photos'];

async function deleteUserStorage(supabaseAdmin: any, userId: string): Promise<void> {
  for (const bucket of USER_BUCKETS) {
    while (true) {
      const { data: objects, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(userId, { limit: 100 });

      if (error) {
        console.error(`Error listing ${bucket}/${userId}:`, error.message);
        break;
      }
      if (!objects || objects.length === 0) break;

      const paths = objects.map((o: any) => `${userId}/${o.name}`);
      const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`Error removing from ${bucket}:`, removeError.message);
        break;
      }
      if (objects.length < 100) break;
    }
  }
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // verify_jwt is enabled for this function; resolve the caller from the token
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    console.log(`Deleting account ${userId}`);

    // Storage objects are not covered by FK cascades — remove them first
    await deleteUserStorage(supabaseAdmin, userId);

    // public.users.id -> auth.users(id) ON DELETE CASCADE, and every table
    // referencing users cascades, so this erases all remaining user data
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account', message: deleteError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-account function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
