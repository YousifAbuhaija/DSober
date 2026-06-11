-- Add dd_status field to users table for global DD revocation
-- This allows tracking if a DD is globally revoked vs just not being a DD

-- Add the dd_status column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS dd_status TEXT NOT NULL DEFAULT 'none' 
CHECK (dd_status IN ('none', 'active', 'revoked'));

-- Update existing users based on their is_dd status
UPDATE users 
SET dd_status = CASE 
  WHEN is_dd = true THEN 'active'
  ELSE 'none'
END
WHERE dd_status = 'none';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_dd_status ON users(dd_status);
