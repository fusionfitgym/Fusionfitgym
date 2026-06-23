-- ============================================================
-- FusionFit Gym Management System — Migration v6
-- Create profile-photos storage bucket and setup RLS policies
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Create storage bucket for member profile photos if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5MB limit
  '{"image/jpeg", "image/png", "image/gif", "image/webp"}'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure RLS is enabled on storage.objects (enabled by default in Supabase, comment out if permission error occurs)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy to allow public access to retrieve profile photos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');

-- 4. Policy to allow authenticated users to upload profile photos
DROP POLICY IF EXISTS "Allow Authenticated Uploads" ON storage.objects;
CREATE POLICY "Allow Authenticated Uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos');

-- 5. Policy to allow authenticated users to update/overwrite profile photos
DROP POLICY IF EXISTS "Allow Authenticated Updates" ON storage.objects;
CREATE POLICY "Allow Authenticated Updates" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos');

-- 6. Policy to allow authenticated users to delete profile photos
DROP POLICY IF EXISTS "Allow Authenticated Deletions" ON storage.objects;
CREATE POLICY "Allow Authenticated Deletions" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos');
