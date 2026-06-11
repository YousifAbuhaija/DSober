-- Add profile-photos storage bucket and policies
-- This allows DDs to upload profile photos during onboarding

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create profile-photos bucket (public for easy access on DD cards)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true, -- Public bucket so photos can be displayed on DD cards
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Users can upload their own profile photo
CREATE POLICY "Users can upload their own profile photo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own profile photo
CREATE POLICY "Users can read their own profile photo"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'profile-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read profile photos of DDs in their group (for DD cards)
CREATE POLICY "Users can read profile photos in their group"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT u.id::text FROM users u
      INNER JOIN users viewer ON viewer.id = auth.uid()
      WHERE u.group_id = viewer.group_id
    )
  );

-- Users can update their own profile photo
CREATE POLICY "Users can update their own profile photo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own profile photo
CREATE POLICY "Users can delete their own profile photo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
