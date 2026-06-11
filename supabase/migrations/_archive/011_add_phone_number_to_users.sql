-- Add phone_number column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
