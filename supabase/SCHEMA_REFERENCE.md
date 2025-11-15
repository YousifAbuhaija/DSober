# Database Schema Reference

Quick reference for the DSober database schema.

## Tables Overview

### groups
Fraternity/sorority organizations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | TEXT | NOT NULL | Organization name |
| access_code | TEXT | UNIQUE, NOT NULL | Code to join group |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Indexes:** None
**RLS:** Users can read their own group

---

### users
User profiles extending auth.users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK → auth.users | User identifier |
| email | TEXT | NOT NULL | User email (auto-synced) |
| name | TEXT | NOT NULL | Full name |
| birthday | DATE | NOT NULL | Date of birth |
| age | INTEGER | | Calculated age |
| gender | TEXT | NOT NULL | Gender identity |
| group_id | UUID | FK → groups | Group membership |
| role | TEXT | NOT NULL, DEFAULT 'member' | 'admin' or 'member' |
| is_dd | BOOLEAN | NOT NULL, DEFAULT false | DD opt-in status |
| car_make | TEXT | | Vehicle make (if DD) |
| car_model | TEXT | | Vehicle model (if DD) |
| car_plate | TEXT | | License plate (if DD) |
| license_photo_url | TEXT | | License photo URL (if DD) |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Indexes:** group_id, email
**RLS:** Users can read/update own record; users can read others in group; admins can update users in group

---

### events
Social events requiring DDs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| group_id | UUID | NOT NULL, FK → groups | Owning group |
| name | TEXT | NOT NULL | Event name |
| description | TEXT | | Event description |
| date_time | TIMESTAMPTZ | NOT NULL | Event date/time |
| location_text | TEXT | NOT NULL | Event location |
| status | TEXT | NOT NULL, DEFAULT 'upcoming' | 'upcoming', 'active', 'completed' |
| created_by_user_id | UUID | NOT NULL, FK → users | Creator user ID |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Indexes:** group_id, date_time
**RLS:** Users can read events in their group; admins can create/update events in their group

---

### dd_requests
Requests to be a DD for an event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| event_id | UUID | NOT NULL, FK → events | Target event |
| user_id | UUID | NOT NULL, FK → users | Requesting user |
| status | TEXT | NOT NULL, DEFAULT 'pending' | 'pending', 'approved', 'rejected' |
| created_at | TIMESTAMPTZ | NOT NULL | Request timestamp |

**Unique:** (event_id, user_id)
**Indexes:** event_id, user_id, status
**RLS:** Users can create/read own requests; admins can read/update requests for their group events

---

### dd_assignments
Approved DD assignments to events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| event_id | UUID | NOT NULL, FK → events | Target event |
| user_id | UUID | NOT NULL, FK → users | Assigned DD |
| status | TEXT | NOT NULL, DEFAULT 'assigned' | 'assigned', 'revoked' |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Unique:** (event_id, user_id)
**Indexes:** event_id, user_id
**RLS:** Users can read assignments for events in their group; admins can create/update assignments for their group events

---

### sep_baselines
User baseline SEP measurements.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | UNIQUE, NOT NULL, FK → users | User identifier |
| reaction_avg_ms | NUMERIC | NOT NULL | Average reaction time (ms) |
| phrase_duration_sec | NUMERIC | NOT NULL | Phrase duration (seconds) |
| selfie_url | TEXT | NOT NULL | Baseline selfie URL |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Indexes:** None (user_id is unique)
**RLS:** Users can read/write own baseline; admins can read baselines for users in their group

---

### sep_attempts
SEP verification attempts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | NOT NULL, FK → users | User identifier |
| event_id | UUID | FK → events | Related event (optional) |
| reaction_avg_ms | NUMERIC | NOT NULL | Reaction time (ms) |
| phrase_duration_sec | NUMERIC | NOT NULL | Phrase duration (seconds) |
| selfie_url | TEXT | NOT NULL | Attempt selfie URL |
| result | TEXT | NOT NULL | 'pass' or 'fail' |
| created_at | TIMESTAMPTZ | NOT NULL | Attempt timestamp |

**Indexes:** None
**RLS:** Users can read/insert own attempts; admins can read attempts for users in their group

---

### dd_sessions
Active DD sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | NOT NULL, FK → users | DD user |
| event_id | UUID | NOT NULL, FK → events | Event |
| started_at | TIMESTAMPTZ | NOT NULL | Session start time |
| ended_at | TIMESTAMPTZ | | Session end time |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active status |

**Indexes:** event_id, is_active
**RLS:** Users can read active sessions for events in their group; users can insert/update own sessions; admins can read all sessions for their group events

---

### admin_alerts
Alerts for admins (e.g., SEP failures).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| type | TEXT | NOT NULL | Alert type (e.g., 'SEP_FAIL') |
| user_id | UUID | NOT NULL, FK → users | Related user |
| event_id | UUID | NOT NULL, FK → events | Related event |
| sep_attempt_id | UUID | NOT NULL, FK → sep_attempts | Related SEP attempt |
| created_at | TIMESTAMPTZ | NOT NULL | Alert timestamp |
| resolved_by_admin_id | UUID | FK → users | Resolving admin |
| resolved_at | TIMESTAMPTZ | | Resolution timestamp |

**Indexes:** resolved_at
**RLS:** Admins can read/update alerts for their group events; system can create alerts

---

## Storage Buckets

### license-photos
Driver license photos.

- **Path pattern:** `{userId}/license.jpg`
- **Public:** No
- **Max size:** 5MB
- **MIME types:** image/jpeg, image/png
- **Policies:** Users can upload/read/update/delete own; admins can read in their group

### sep-selfies
SEP verification selfies.

- **Path pattern:** `{userId}/{timestamp}.jpg`
- **Public:** No
- **Max size:** 2MB
- **MIME types:** image/jpeg, image/png
- **Policies:** Users can upload/read own; admins can read in their group

### sep-audio
SEP phrase recordings.

- **Path pattern:** `{userId}/{timestamp}.m4a`
- **Public:** No
- **Max size:** 1MB
- **MIME types:** audio/mp4, audio/mpeg, audio/x-m4a
- **Policies:** Users can upload/read/delete own; admins can read in their group

---

## Relationships

```
groups
  ↓ (1:N)
users
  ↓ (1:N)
events ← created_by_user_id
  ↓ (1:N)
dd_requests → user_id
dd_assignments → user_id
dd_sessions → user_id
admin_alerts → user_id, sep_attempt_id

users
  ↓ (1:1)
sep_baselines

users
  ↓ (1:N)
sep_attempts → event_id (optional)
```

---

## Common Queries

### Get user with group info
```sql
SELECT u.*, g.name as group_name
FROM users u
LEFT JOIN groups g ON g.id = u.group_id
WHERE u.id = 'user-uuid';
```

### Get events for user's group
```sql
SELECT e.*
FROM events e
INNER JOIN users u ON u.group_id = e.group_id
WHERE u.id = 'user-uuid'
ORDER BY e.date_time DESC;
```

### Get active DDs for an event
```sql
SELECT u.name, u.car_make, u.car_model, u.car_plate, s.*
FROM dd_sessions s
INNER JOIN users u ON u.id = s.user_id
WHERE s.event_id = 'event-uuid' AND s.is_active = true;
```

### Get pending DD requests for admin
```sql
SELECT r.*, u.name as user_name, e.name as event_name
FROM dd_requests r
INNER JOIN users u ON u.id = r.user_id
INNER JOIN events e ON e.id = r.event_id
INNER JOIN users admin ON admin.id = 'admin-uuid'
WHERE e.group_id = admin.group_id 
  AND admin.role = 'admin'
  AND r.status = 'pending';
```

### Get unresolved SEP fail alerts
```sql
SELECT a.*, u.name as user_name, e.name as event_name, sa.*
FROM admin_alerts a
INNER JOIN users u ON u.id = a.user_id
INNER JOIN events e ON e.id = a.event_id
INNER JOIN sep_attempts sa ON sa.id = a.sep_attempt_id
INNER JOIN users admin ON admin.id = 'admin-uuid'
WHERE e.group_id = admin.group_id
  AND admin.role = 'admin'
  AND a.type = 'SEP_FAIL'
  AND a.resolved_at IS NULL;
```

---

## SEP Evaluation Logic

```typescript
const REACTION_TOLERANCE_MS = 150;
const PHRASE_TOLERANCE_SEC = 2;

function evaluateSEP(baseline, attempt) {
  const reactionOk = attempt.reaction_avg_ms <= (baseline.reaction_avg_ms + REACTION_TOLERANCE_MS);
  const phraseOk = attempt.phrase_duration_sec <= (baseline.phrase_duration_sec + PHRASE_TOLERANCE_SEC);
  
  return {
    pass: reactionOk && phraseOk,
    reactionOk,
    phraseOk
  };
}
```

---

## Triggers

### update_updated_at_column
Automatically updates `updated_at` timestamp on:
- users
- dd_assignments

### set_user_email_on_insert
Automatically syncs email from auth.users when creating user record.
