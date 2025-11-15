-- DSober Database Schema Migration (Fixed Version)
-- This migration creates all tables, relationships, and indexes
-- RLS policies are applied in migration 003

-- ============================================================================
-- TABLES
-- ============================================================================

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  birthday DATE NOT NULL,
  age INTEGER,
  gender TEXT NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_dd BOOLEAN NOT NULL DEFAULT false,
  car_make TEXT,
  car_model TEXT,
  car_plate TEXT,
  license_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  date_time TIMESTAMPTZ NOT NULL,
  location_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DD Requests table
CREATE TABLE IF NOT EXISTS dd_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- DD Assignments table
CREATE TABLE IF NOT EXISTS dd_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'revoked')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- SEP Baselines table
CREATE TABLE IF NOT EXISTS sep_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_avg_ms NUMERIC NOT NULL,
  phrase_duration_sec NUMERIC NOT NULL,
  selfie_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SEP Attempts table
CREATE TABLE IF NOT EXISTS sep_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  reaction_avg_ms NUMERIC NOT NULL,
  phrase_duration_sec NUMERIC NOT NULL,
  selfie_url TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DD Sessions table
CREATE TABLE IF NOT EXISTS dd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Admin Alerts table
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sep_attempt_id UUID NOT NULL REFERENCES sep_attempts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_date_time ON events(date_time);
CREATE INDEX IF NOT EXISTS idx_dd_requests_event_id ON dd_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_dd_requests_user_id ON dd_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_dd_requests_status ON dd_requests(status);
CREATE INDEX IF NOT EXISTS idx_dd_assignments_event_id ON dd_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_dd_assignments_user_id ON dd_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_dd_sessions_event_id ON dd_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_dd_sessions_is_active ON dd_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_resolved_at ON admin_alerts(resolved_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp for users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dd_assignments_updated_at
  BEFORE UPDATE ON dd_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically set user email from auth.users
CREATE OR REPLACE FUNCTION set_user_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_user_email_on_insert
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_email();

-- ============================================================================
-- ENABLE RLS (policies applied in migration 003)
-- ============================================================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sep_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sep_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert test groups with access codes
INSERT INTO groups (name, access_code) VALUES
  ('Alpha Beta Gamma', 'ABG2024'),
  ('Delta Epsilon Zeta', 'DEZ2024'),
  ('Theta Kappa Lambda', 'TKL2024')
ON CONFLICT (access_code) DO NOTHING;
