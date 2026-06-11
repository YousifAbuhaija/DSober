-- Set all users' phone numbers to test number for development
UPDATE users 
SET phone_number = '+1 (571) 419-3903'
WHERE phone_number IS NULL OR phone_number = '';

-- Also update any existing phone numbers to the test number
UPDATE users 
SET phone_number = '+1 (571) 419-3903';
