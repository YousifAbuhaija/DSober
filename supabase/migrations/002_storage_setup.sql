-- DSober Storage Buckets and Policies Setup
-- This migration creates storage buckets and their access policies

-- ============================================================================
-- DROP EXISTING STORAGE POLICIES (if any)
-- ============================================================================

DROP POLICY IF EXISTS "Users can upload their own license photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own license photo" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read license photos in their group" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own license photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own license photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own SEP selfies" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own SEP selfies" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read SEP selfies in their group" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own SEP audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own SEP audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read SEP audio in their group" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own SEP audio" ON storage.objects;

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create license-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'license-photos',
  'license-photos',
  false,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Create sep-selfies bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sep-selfies',
  'sep-selfies',
  false,
  2097152, -- 2MB in bytes
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Create sep-audio bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sep-audio',
  'sep-audio',
  false,
  1048576, -- 1MB in bytes
  ARRAY['audio/mp4', 'audio/mpeg', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- License Photos Policies
-- Users can upload their own license photo
CREATE POLICY "Users can upload their own license photo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'license-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own license photo
CREATE POLICY "Users can read their own license photo"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'license-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read license photos in their group
CREATE POLICY "Admins can read license photos in their group"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'license-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT u.id::text FROM users u
      INNER JOIN users admin ON admin.id = auth.uid()
      WHERE u.group_id = admin.group_id AND admin.role = 'admin'
    )
  );

-- Users can update their own license photo
CREATE POLICY "Users can update their own license photo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'license-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own license photo
CREATE POLICY "Users can delete their own license photo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'license-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- SEP Selfies Policies
-- Users can upload their own SEP selfies
CREATE POLICY "Users can upload their own SEP selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sep-selfies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own SEP selfies
CREATE POLICY "Users can read their own SEP selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sep-selfies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read SEP selfies in their group
CREATE POLICY "Admins can read SEP selfies in their group"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sep-selfies' AND
    (storage.foldername(name))[1] IN (
      SELECT u.id::text FROM users u
      INNER JOIN users admin ON admin.id = auth.uid()
      WHERE u.group_id = admin.group_id AND admin.role = 'admin'
    )
  );

-- SEP Audio Policies
-- Users can upload their own SEP audio recordings
CREATE POLICY "Users can upload their own SEP audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sep-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own SEP audio recordings
CREATE POLICY "Users can read their own SEP audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sep-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read SEP audio in their group
CREATE POLICY "Admins can read SEP audio in their group"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sep-audio' AND
    (storage.foldername(name))[1] IN (
      SELECT u.id::text FROM users u
      INNER JOIN users admin ON admin.id = auth.uid()
      WHERE u.group_id = admin.group_id AND admin.role = 'admin'
    )
  );

-- Users can delete their own SEP audio (optional cleanup)
CREATE POLICY "Users can delete their own SEP audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'sep-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
