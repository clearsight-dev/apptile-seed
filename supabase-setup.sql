-- ============================================
-- Supabase Database Setup for Pothole Patrol
-- ============================================
-- Run this in Supabase SQL Editor

-- 1. Create potholes table
CREATE TABLE IF NOT EXISTS potholes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('Insurance Claimer', 'The Spine Rattler', 'Stairway to Heaven')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'verified', 'fixed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE potholes ENABLE ROW LEVEL SECURITY;

-- 3. Create policy to allow public read access
CREATE POLICY "Allow public read access"
ON potholes
FOR SELECT
TO public
USING (true);

-- 4. Create policy to allow public insert access
CREATE POLICY "Allow public insert access"
ON potholes
FOR INSERT
TO public
WITH CHECK (true);

-- 5. Create policy to allow public update access (for edge function to update severity)
CREATE POLICY "Allow public update access"
ON potholes
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 6. Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_potholes_created_at ON potholes(created_at DESC);

-- 7. Create index on severity for filtering
CREATE INDEX IF NOT EXISTS idx_potholes_severity ON potholes(severity);

-- 8. Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_potholes_status ON potholes(status);

-- ============================================
-- Verify Setup
-- ============================================

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'potholes'
) AS table_exists;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'potholes';

-- Count existing potholes
SELECT COUNT(*) as total_potholes FROM potholes;

-- Show all potholes
SELECT * FROM potholes ORDER BY created_at DESC;

