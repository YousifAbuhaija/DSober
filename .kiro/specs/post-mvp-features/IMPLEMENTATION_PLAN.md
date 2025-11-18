# Post-MVP Features Implementation Plan

## Overview

This document outlines the implementation strategy for five major features that will enhance DSober's safety, usability, and operational efficiency:

1. Push Notifications
2. Ride History & Analytics
3. Emergency Features
4. Compliance & Liability Tools
5. Smart DD Matching Algorithm

## Implementation Priority & Dependencies

### Phase 1: Foundation (Weeks 1-2)
- **Push Notifications** - Critical infrastructure that other features depend on
- **Ride History & Analytics** - Data layer needed for compliance and matching

### Phase 2: Safety & Operations (Weeks 3-4)
- **Emergency Features** - Leverages push notifications
- **Smart DD Matching Algorithm** - Uses ride history data

### Phase 3: Legal & Compliance (Week 5)
- **Compliance & Liability Tools** - Builds on ride history and emergency features

---

## Feature 1: Push Notifications

### Technical Approach
- **Service**: Expo Push Notifications (free, built-in)
- **Backend**: Supabase Edge Functions for sending notifications
- **Storage**: New `push_tokens` table to store device tokens

### Database Changes
```sql
-- New table for push notification tokens
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New table for notification history
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Notification Types
1. **Ride Request Accepted** - "John accepted your ride request!"
2. **DD Arriving** - "Your DD is 5 minutes away"
3. **Ride Completed** - "Rate your ride with John"
4. **DD Session Expiring** - "Your DD session expires in 15 minutes"
5. **Event Starting** - "Party at Sigma Chi starts in 1 hour"
6. **Admin Alert** - "Emergency: Check admin dashboard"
7. **Emergency Panic** - "EMERGENCY: Sarah triggered panic button"

### Implementation Tasks
- [ ] Install expo-notifications package
- [ ] Create push_tokens and notifications tables
- [ ] Build token registration on app launch
- [ ] Create Supabase Edge Function for sending notifications
- [ ] Add notification triggers to key events (ride accepted, etc.)
- [ ] Build in-app notification center
- [ ] Add notification preferences screen
- [ ] Test on iOS and Android devices

### Estimated Effort
**3-4 days** (includes testing on physical devices)

---

## Feature 2: Ride History & Analytics

### Technical Approach
- **Data Source**: Existing `dd_sessions` and `ride_requests` tables
- **New Tables**: `ride_ratings`, `ride_analytics_cache`
- **UI**: New screens for history and analytics dashboards

### Database Changes
```sql
-- Ride ratings table
CREATE TABLE ride_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_request_id UUID REFERENCES ride_requests(id) ON DELETE CASCADE,
  dd_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  rating_type TEXT CHECK (rating_type IN ('dd_to_rider', 'rider_to_dd')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ride_request_id, rating_type)
);

-- Analytics cache for performance
CREATE TABLE ride_analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'user_stats', 'group_stats', 'dd_performance'
  data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id, metric_type)
);

-- Add rating fields to users table
ALTER TABLE users ADD COLUMN avg_dd_rating DECIMAL(3,2);
ALTER TABLE users ADD COLUMN avg_rider_rating DECIMAL(3,2);
ALTER TABLE users ADD COLUMN total_rides_given INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN total_rides_taken INTEGER DEFAULT 0;
```

### Analytics Metrics

#### Personal Stats (Riders)
- Total rides taken
- Favorite DDs
- Most common pickup/dropoff locations
- Busiest nights
- Average wait time

#### Personal Stats (DDs)
- Total rides given
- Total hours driven
- Average rating
- Most common routes
- Busiest time slots
- Total distance driven (if tracking)

#### Group Analytics (Admin)
- Total rides per week/month
- Most active DDs
- Busiest event times
- Average response time
- Safety incidents
- DD utilization rate
- Peak demand hours

### UI Components
- **RideHistoryScreen** - List of past rides with details
- **RideDetailScreen** - Individual ride details with map
- **AnalyticsDashboardScreen** - Charts and metrics
- **RatingModal** - Post-ride rating interface
- **DDPerformanceScreen** - DD-specific metrics

### Implementation Tasks
- [ ] Create ride_ratings and ride_analytics_cache tables
- [ ] Build rating modal component
- [ ] Add rating prompt after ride completion
- [ ] Create RideHistoryScreen with filtering
- [ ] Build analytics calculation functions
- [ ] Create AnalyticsDashboardScreen with charts
- [ ] Add export functionality for ride logs
- [ ] Implement caching strategy for analytics
- [ ] Add rating display to DD profiles

### Estimated Effort
**5-6 days** (includes chart library integration)

---

## Feature 3: Emergency Features

### Technical Approach
- **Panic Button**: Prominent UI element on active ride screens
- **Location Tracking**: Enhanced real-time location updates during emergencies
- **Notifications**: Immediate push to admins and emergency contacts
- **Backend**: Supabase Edge Function for emergency handling

### Database Changes
```sql
-- Emergency contacts table
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency incidents table
CREATE TABLE emergency_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ride_request_id UUID REFERENCES ride_requests(id) ON DELETE SET NULL,
  dd_session_id UUID REFERENCES dd_sessions(id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL, -- 'panic_button', 'geofence_violation', 'manual_report'
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  description TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'resolved', 'false_alarm'
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB, -- photos, videos, additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency incident responses
CREATE TABLE emergency_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES users(id) ON DELETE SET NULL,
  response_type TEXT NOT NULL, -- 'acknowledged', 'en_route', 'on_scene', 'resolved'
  notes TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add emergency contact to users table
ALTER TABLE users ADD COLUMN emergency_contact_notified BOOLEAN DEFAULT FALSE;
```

### Emergency Features

#### 1. Panic Button
- Large, accessible button on ride screens
- Requires confirmation to prevent accidental triggers
- Immediately captures location, photos (optional)
- Sends notifications to:
  - All group admins
  - Emergency contacts
  - Other DDs in the area (optional)

#### 2. Incident Reporting
- Manual incident report form
- Photo/video evidence upload
- Witness statements
- Automatic metadata capture (time, location, users involved)

#### 3. Emergency Dashboard (Admin)
- Real-time incident monitoring
- Map view of active incidents
- Response tracking
- Incident history and resolution

#### 4. Safety Check-In
- Automatic "Are you safe?" prompt if ride takes too long
- Missed check-in triggers alert
- Configurable check-in intervals

#### 5. Geofencing Alerts (Future)
- Alert if DD leaves approved area
- Notify if user enters high-risk zone
- Campus boundary enforcement

### UI Components
- **PanicButton** - Prominent emergency button component
- **EmergencyConfirmModal** - Confirmation before triggering
- **IncidentReportScreen** - Manual incident reporting
- **EmergencyDashboardScreen** - Admin incident monitoring
- **EmergencyContactsScreen** - Manage emergency contacts
- **IncidentDetailScreen** - View incident details and responses

### Implementation Tasks
- [ ] Create emergency database tables
- [ ] Build PanicButton component
- [ ] Create emergency confirmation modal
- [ ] Implement emergency notification system
- [ ] Build IncidentReportScreen
- [ ] Create EmergencyDashboardScreen for admins
- [ ] Add emergency contacts management
- [ ] Implement location tracking during emergencies
- [ ] Build incident resolution workflow
- [ ] Add photo/video evidence upload
- [ ] Create safety check-in system
- [ ] Test emergency notification delivery

### Estimated Effort
**6-7 days** (critical feature requiring thorough testing)

---

## Feature 4: Compliance & Liability Tools

### Technical Approach
- **Digital Waivers**: PDF generation and e-signature
- **Incident Documentation**: Structured reporting with evidence
- **Audit Logs**: Track all critical actions
- **Export Tools**: Generate reports for legal/insurance purposes

### Database Changes
```sql
-- Waivers and consent forms
CREATE TABLE waivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User waiver signatures
CREATE TABLE waiver_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  waiver_id UUID REFERENCES waivers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  signature_data TEXT, -- Base64 encoded signature image
  ip_address TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(waiver_id, user_id)
);

-- Audit log for compliance
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'ride_started', 'sep_failed', 'dd_revoked', etc.
  entity_type TEXT, -- 'ride_request', 'dd_session', 'user', etc.
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insurance information
CREATE TABLE insurance_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  expiration_date DATE NOT NULL,
  coverage_amount DECIMAL(12, 2),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add insurance fields to users table
ALTER TABLE users ADD COLUMN insurance_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN insurance_expiration DATE;
```

### Compliance Features

#### 1. Digital Waivers
- Customizable waiver templates
- E-signature capture
- Version control
- Automatic re-signing when waivers update
- Required before first ride

#### 2. Incident Documentation
- Structured incident reports
- Photo/video evidence storage
- Witness statements
- Timeline reconstruction
- Export to PDF

#### 3. Audit Logging
- Track all critical actions:
  - Ride requests and completions
  - SEP verification attempts
  - DD status changes
  - Admin actions
  - Emergency incidents
- Immutable log entries
- Searchable and filterable

#### 4. Insurance Verification
- DD insurance information collection
- Expiration tracking
- Admin verification workflow
- Automatic reminders before expiration

#### 5. Compliance Reports
- Export ride logs for date ranges
- Generate incident reports
- User activity summaries
- SEP verification history
- DD performance reports

#### 6. Data Retention Policies
- Configurable retention periods
- Automatic data archival
- GDPR/privacy compliance tools
- User data export (right to access)
- User data deletion (right to be forgotten)

### UI Components
- **WaiverScreen** - Display and sign waivers
- **SignaturePad** - Capture e-signatures
- **ComplianceDashboardScreen** - Admin compliance overview
- **AuditLogScreen** - View audit logs
- **InsuranceInfoScreen** - Manage insurance information
- **ReportGeneratorScreen** - Generate compliance reports
- **DataExportScreen** - Export user data

### Implementation Tasks
- [ ] Create compliance database tables
- [ ] Build waiver management system
- [ ] Implement signature capture component
- [ ] Create audit logging middleware
- [ ] Build insurance verification workflow
- [ ] Create ComplianceDashboardScreen
- [ ] Implement report generation (PDF export)
- [ ] Add audit log viewer
- [ ] Build data export functionality
- [ ] Implement data retention policies
- [ ] Add insurance expiration reminders
- [ ] Create waiver version control system

### Estimated Effort
**7-8 days** (includes PDF generation and legal considerations)

---

## Feature 5: Smart DD Matching Algorithm

### Technical Approach
- **Algorithm**: Multi-factor scoring system
- **Factors**: Distance, availability, rating, capacity, workload
- **Execution**: Supabase Edge Function or PostgreSQL function
- **Fallback**: Manual assignment if auto-match fails

### Database Changes
```sql
-- DD availability preferences
CREATE TABLE dd_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dd_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DD capacity and preferences
ALTER TABLE users ADD COLUMN max_riders INTEGER DEFAULT 4;
ALTER TABLE users ADD COLUMN auto_accept_rides BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN preferred_areas TEXT[]; -- Array of location names

-- Matching algorithm metrics
CREATE TABLE match_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_request_id UUID REFERENCES ride_requests(id) ON DELETE CASCADE,
  dd_id UUID REFERENCES users(id) ON DELETE CASCADE,
  distance_score DECIMAL(5, 2),
  rating_score DECIMAL(5, 2),
  workload_score DECIMAL(5, 2),
  availability_score DECIMAL(5, 2),
  total_score DECIMAL(5, 2),
  matched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Matching Algorithm

#### Scoring Factors (0-100 points each)

1. **Distance Score (40% weight)**
   - 0-0.5 miles: 100 points
   - 0.5-1 mile: 80 points
   - 1-2 miles: 60 points
   - 2-5 miles: 40 points
   - 5+ miles: 20 points

2. **Rating Score (25% weight)**
   - 5.0 stars: 100 points
   - 4.5-4.9: 90 points
   - 4.0-4.4: 80 points
   - 3.5-3.9: 70 points
   - <3.5: 50 points
   - No rating: 75 points (neutral)

3. **Workload Score (20% weight)**
   - 0 active rides: 100 points
   - 1 active ride: 70 points
   - 2 active rides: 40 points
   - 3+ active rides: 20 points

4. **Availability Score (15% weight)**
   - Auto-accept enabled: 100 points
   - Currently active session: 80 points
   - Available but not active: 60 points
   - Preferred area match: +20 bonus

#### Matching Logic
```
1. Filter eligible DDs:
   - is_dd = true
   - dd_status = 'active'
   - Has active DD session OR auto_accept enabled
   - Not at max capacity
   - Within reasonable distance (< 10 miles)

2. Calculate scores for each eligible DD

3. Sort by total weighted score (descending)

4. Auto-assign to top DD if auto_accept enabled
   OR send notification to top 3 DDs

5. If no response in 2 minutes, notify next batch

6. Fallback to manual assignment after 5 minutes
```

### Smart Features

#### 1. Auto-Assignment
- Instant assignment to best-match DD
- Requires DD to enable auto-accept
- Configurable acceptance timeout

#### 2. Multi-DD Notification
- Notify top 3 DDs simultaneously
- First to accept gets the ride
- Others notified when ride is taken

#### 3. Load Balancing
- Distribute rides evenly across DDs
- Prevent DD burnout
- Track rides per DD per event

#### 4. Route Optimization
- Suggest multi-stop routes
- Group nearby pickup requests
- Minimize total drive time

#### 5. Predictive Matching
- Learn from past matches
- Identify DD-rider preferences
- Optimize for user satisfaction

### UI Components
- **DDAvailabilityScreen** - Set availability preferences
- **AutoAcceptToggle** - Enable/disable auto-accept
- **MatchingStatusModal** - Show matching progress
- **DDCapacitySettings** - Configure max riders
- **MatchAnalyticsScreen** - View matching performance

### Implementation Tasks
- [ ] Create DD availability and matching tables
- [ ] Build scoring algorithm function
- [ ] Implement auto-assignment logic
- [ ] Create multi-DD notification system
- [ ] Build DDAvailabilityScreen
- [ ] Add auto-accept toggle to DD settings
- [ ] Implement matching timeout and fallback
- [ ] Create load balancing logic
- [ ] Build match analytics tracking
- [ ] Add route optimization suggestions
- [ ] Test matching algorithm with various scenarios
- [ ] Tune scoring weights based on real data

### Estimated Effort
**5-6 days** (includes algorithm testing and tuning)

---

## Implementation Timeline

### Week 1: Push Notifications
- Days 1-2: Setup, database, token registration
- Days 3-4: Notification triggers and testing
- Day 5: In-app notification center

### Week 2: Ride History & Analytics
- Days 1-2: Database schema, rating system
- Days 3-4: History screens and analytics calculations
- Day 5: Charts and export functionality

### Week 3: Emergency Features
- Days 1-2: Database schema, panic button
- Days 3-4: Emergency notifications and dashboard
- Day 5: Incident reporting and testing

### Week 4: Smart DD Matching
- Days 1-2: Algorithm development and database
- Days 3-4: Auto-assignment and notifications
- Day 5: Testing and tuning

### Week 5: Compliance & Liability
- Days 1-2: Waivers and signatures
- Days 3-4: Audit logging and insurance
- Days 5: Reports and data export

---

## Technical Dependencies

### New Packages Required
```json
{
  "expo-notifications": "~0.28.0",
  "expo-signature-pad": "^1.0.0",
  "react-native-chart-kit": "^6.12.0",
  "react-native-svg": "^15.0.0",
  "expo-print": "~13.0.0",
  "expo-sharing": "~12.0.0"
}
```

### Supabase Edge Functions
1. `send-push-notification` - Send push notifications
2. `match-dd-to-ride` - Execute matching algorithm
3. `handle-emergency` - Process emergency incidents
4. `generate-compliance-report` - Generate PDF reports

### Environment Variables
```env
EXPO_PUBLIC_EMERGENCY_PHONE=+1234567890
EXPO_PUBLIC_ENABLE_AUTO_MATCHING=true
EXPO_PUBLIC_MATCHING_TIMEOUT_MS=120000
```

---

## Testing Strategy

### Unit Tests
- Matching algorithm scoring
- Distance calculations
- Rating calculations
- Audit log formatting

### Integration Tests
- Push notification delivery
- Emergency incident workflow
- Waiver signing flow
- Report generation

### E2E Tests
- Complete ride with auto-matching
- Emergency panic button flow
- Analytics data accuracy
- Compliance report export

### Load Tests
- Matching algorithm performance with 100+ DDs
- Push notification delivery at scale
- Analytics calculation performance

---

## Rollout Strategy

### Phase 1: Beta Testing (Week 6)
- Deploy to test group (single fraternity/sorority)
- Monitor for bugs and performance issues
- Gather user feedback
- Tune matching algorithm weights

### Phase 2: Gradual Rollout (Week 7)
- Deploy push notifications to all users
- Enable ride history and analytics
- Keep emergency features in beta
- Monitor notification delivery rates

### Phase 3: Full Deployment (Week 8)
- Enable all features for all users
- Activate smart matching algorithm
- Launch compliance tools for admins
- Monitor system performance

### Phase 4: Optimization (Week 9+)
- Tune matching algorithm based on data
- Optimize notification timing
- Improve analytics performance
- Add requested features

---

## Success Metrics

### Push Notifications
- Delivery rate > 95%
- Open rate > 60%
- Time to notification < 5 seconds

### Ride History & Analytics
- User engagement with history > 40%
- Admin dashboard usage > 80%
- Export feature usage > 20%

### Emergency Features
- False alarm rate < 10%
- Admin response time < 2 minutes
- User confidence score > 4.5/5

### Smart Matching
- Auto-match success rate > 70%
- Average match time < 30 seconds
- User satisfaction with matches > 4.0/5

### Compliance
- Waiver completion rate > 95%
- Insurance verification rate > 90%
- Audit log completeness > 99%

---

## Risk Mitigation

### Technical Risks
- **Push notification failures**: Implement retry logic and fallback SMS
- **Matching algorithm bugs**: Keep manual assignment as fallback
- **Emergency system downtime**: Use external monitoring and alerts
- **Data privacy issues**: Implement strict RLS and encryption

### Operational Risks
- **False emergency alerts**: Require confirmation, track false alarm rate
- **DD gaming the system**: Monitor for suspicious patterns
- **Legal liability**: Consult legal counsel on waivers and policies
- **User adoption**: Provide training and clear documentation

---

## Next Steps

1. Review and approve this implementation plan
2. Create individual spec documents for each feature
3. Set up project tracking (GitHub issues, Jira, etc.)
4. Begin Week 1: Push Notifications implementation
5. Schedule weekly check-ins to review progress

