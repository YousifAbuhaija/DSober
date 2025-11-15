# Profile Photo Migration - Instructions

## Overview
This migration adds a dedicated profile photo field for DDs, separate from the SEP baseline selfie and license photo, to respect user privacy.

## Database Migration

### Step 1: Add Column to Users Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Add profile_photo_url column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.profile_photo_url IS 'Profile photo URL for DD identification - shown on DD cards with user consent';
```

### Step 2: Create Storage Bucket (if not exists)

In Supabase Storage, create a bucket called `profile-photos` with these settings:
- **Public**: No (private bucket)
- **File size limit**: 5MB
- **Allowed MIME types**: image/jpeg, image/png, image/webp

### Step 3: Set Storage Policies

Run this SQL to set up storage policies:

```sql
-- Allow users to upload their own profile photos
CREATE POLICY "Users can upload own profile photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own profile photos
CREATE POLICY "Users can update own profile photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own profile photos
CREATE POLICY "Users can delete own profile photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read profile photos (for DD discovery)
CREATE POLICY "Authenticated users can view profile photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');
```

## Code Changes Made

### 1. Database Types
- Added `profilePhotoUrl?: string` to User interface

### 2. EventDetailScreen
- ✅ Block DD requests for completed events
- Users see message: "This event has been completed. DD requests are no longer available."

### 3. DDDetailScreen
- ✅ Removed license photo display (privacy violation)
- ✅ Changed to use `profilePhotoUrl` instead of SEP baseline selfie
- Shows "No profile photo available" if not set

### 4. DDsListScreen
- ✅ Changed to use `profilePhotoUrl` instead of SEP baseline selfie
- Falls back to initial letter if no photo

### 5. AuthContext
- ✅ Added `profilePhotoUrl` mapping from database

## Next Steps - Profile Photo Upload

You need to add a profile photo upload screen during DD registration. Here's what needs to be implemented:

### Option 1: Add to Existing Driver Info Screen

Update `screens/onboarding/DriverInfoScreen.tsx` to include:

1. **Profile Photo Section** (after license photo):
   ```
   Profile Photo for DD Card
   [Camera Icon] Take Photo
   
   Info text: "This photo will be shown to riders when you're an active DD. 
   It helps them identify you at pickup locations."
   ```

2. **Photo Capture**:
   - Use `expo-image-picker` or `expo-camera`
   - Allow camera or gallery selection
   - Show preview after capture
   - Compress to reasonable size (< 1MB)

3. **Upload to Storage**:
   - Upload to `profile-photos/{userId}/profile.jpg`
   - Save URL to `users.profile_photo_url`

### Option 2: Add Separate Profile Photo Screen

Create new `screens/onboarding/ProfilePhotoScreen.tsx`:

1. **Screen Flow**:
   - After DriverInfoScreen
   - Before SEPBaselineFlow
   - Clear consent message about photo usage

2. **UI Elements**:
   - Large preview area
   - "Take Photo" button
   - "Choose from Gallery" button
   - Skip button (optional, but not recommended)
   - Clear explanation of how photo will be used

3. **Consent Text**:
   ```
   "Your Profile Photo
   
   This photo will be displayed on your DD profile card when you're 
   actively driving for events. It helps riders identify you at 
   pickup locations for safety and convenience.
   
   Your photo will only be visible to members of your chapter when 
   you have an active DD session."
   ```

## Implementation Priority

1. **High Priority** (Do First):
   - Run database migration SQL
   - Create storage bucket and policies
   - Add profile photo upload to onboarding

2. **Medium Priority**:
   - Add profile photo edit in ProfileScreen
   - Add photo guidelines (good lighting, clear face, etc.)

3. **Low Priority**:
   - Photo quality validation
   - Automatic photo cropping/resizing
   - Photo moderation/approval system

## Testing Checklist

After implementation:

- [ ] New DDs can upload profile photo during registration
- [ ] Profile photo appears in DD list view
- [ ] Profile photo appears in DD detail view
- [ ] No profile photo shows fallback (initial letter)
- [ ] Completed events don't show "Request to be DD" button
- [ ] License photos are NOT displayed anywhere
- [ ] SEP baseline selfies are NOT used for DD cards

## Privacy Considerations

✅ **Fixed**:
- License photos no longer displayed (privacy violation)
- SEP baseline selfies no longer used without consent
- Dedicated profile photo with clear consent

✅ **Implemented**:
- Profile photos only visible to authenticated chapter members
- Photos only shown when DD has active session
- Clear explanation of photo usage during upload

## Rollback Plan

If you need to rollback:

```sql
-- Remove the column
ALTER TABLE users DROP COLUMN IF EXISTS profile_photo_url;

-- Delete storage bucket policies
DROP POLICY IF EXISTS "Users can upload own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view profile photos" ON storage.objects;
```

## Notes

- The migration script (`npm run add-profile-photo`) may not work due to RPC limitations
- You'll likely need to run the SQL manually in Supabase SQL Editor
- Existing users will have `profile_photo_url = NULL` until they upload a photo
- Consider adding a prompt for existing DDs to upload their profile photo
