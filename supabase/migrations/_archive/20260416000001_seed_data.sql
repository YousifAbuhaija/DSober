-- Seed Data - Insert Test Groups
-- Run this if groups table is empty

-- Insert test groups with access codes
INSERT INTO groups (name, access_code) VALUES
  ('Alpha Beta Gamma', 'ABG2024'),
  ('Delta Epsilon Zeta', 'DEZ2024'),
  ('Theta Kappa Lambda', 'TKL2024')
ON CONFLICT (access_code) DO NOTHING;

-- Verify insertion
SELECT * FROM groups;
