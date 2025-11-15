-- Fix user state for haijayousif@gmail.com who failed SEP before global revocation was implemented
-- This will set them to globally revoked status

-- 1. Set user's dd_status to 'revoked'
UPDATE users 
SET dd_status = 'revoked'
WHERE email = 'haijayousif@gmail.com';

-- 2. Revoke ALL their DD assignments (not just the one event)
UPDATE dd_assignments 
SET status = 'revoked', updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE email = 'haijayousif@gmail.com');

-- Verify the changes
SELECT 
  u.email, 
  u.is_dd, 
  u.dd_status,
  COUNT(da.id) as total_assignments,
  COUNT(CASE WHEN da.status = 'revoked' THEN 1 END) as revoked_assignments
FROM users u
LEFT JOIN dd_assignments da ON da.user_id = u.id
WHERE u.email = 'haijayousif@gmail.com'
GROUP BY u.id, u.email, u.is_dd, u.dd_status;
