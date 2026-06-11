-- Fix profile-photos bucket to be public
-- This allows profile photos to be displayed on DD cards without signed URLs

UPDATE storage.buckets
SET public = true
WHERE id = 'profile-photos';
