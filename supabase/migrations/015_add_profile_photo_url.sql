-- Add profile_photo_url column to users table
-- This allows DDs to upload a profile photo during onboarding

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.profile_photo_url IS 'URL to user profile photo stored in profile-photos bucket, visible on DD cards';
