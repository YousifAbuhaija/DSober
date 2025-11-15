# DSober MVP Features

## Overview
DSober is a mobile app for fraternities and sororities to manage designated drivers through a sobriety verification system. Built for a 24-hour hackathon MVP.

---

## 🔐 Authentication & Onboarding

### User Registration
- Email/password signup and login
- Secure authentication via Supabase Auth
- Session management with automatic token refresh

### Onboarding Flow
1. **Basic Information**
   - Name, birthday, age, gender
   - Profile creation

2. **Group Membership**
   - Join fraternity/sorority using access code
   - Group-based access control

3. **DD Registration (Optional)**
   - Opt-in to be a designated driver
   - Provide vehicle information:
     - Car make, model, license plate
     - Upload driver's license photo

4. **SEP Baseline Establishment**
   - Reaction time test (3-5 trials, average calculated)
   - Phrase recording (fixed phrase, duration measured)
   - Baseline selfie capture
   - Stored for future verification comparisons

---

## 📅 Event Management

### For All Members
- **View Events**
  - See all upcoming events for your group
  - Event details: name, date/time, location, description
  - See assigned DDs for each event

### For DDs
- **Request to Drive**
  - Request to be a DD for specific events
  - Track request status (pending/approved/rejected)
  - View your DD assignments

### For Admins
- **Create Events**
  - Add new events with details
  - Set event status (upcoming/active/completed)

- **Manage DD Requests**
  - View pending DD requests
  - Approve or reject requests
  - Directly assign DDs to events

---

## 🚗 Sobriety Estimation Protocol (SEP)

### Pre-Drive Verification
Before starting a DD session, assigned DDs must pass SEP:

1. **Reaction Time Test**
   - 3-5 trials with random "Go" signal
   - Average reaction time calculated
   - Must be within 150ms of baseline

2. **Phrase Recording**
   - Record the same fixed phrase from baseline
   - Duration measured in seconds
   - Must be within 2 seconds of baseline

3. **Selfie Capture**
   - Take current selfie for record
   - Uploaded to secure storage

4. **Automatic Evaluation**
   - System compares attempt to baseline
   - Pass: Both metrics within tolerance → DD session starts
   - Fail: Either metric exceeds tolerance → Admin alerted, DD revoked

### Admin Oversight
- **SEP Failure Alerts**
  - Automatic notification when DD fails SEP
  - View failure details and metrics
  - Options:
    - Reinstate DD (override failure)
    - Keep revoked (maintain restriction)

---

## 🎯 Active DD Sessions

### For DDs
- **Session Management**
  - View active session details
  - See elapsed time since session start
  - End session when finished driving

### For Riders
- **Find Active DDs**
  - View all active DDs for selected event
  - See DD information:
    - Name and photo
    - Vehicle details (make, model, plate)
    - Distance from your location (in miles)
  - Sort by proximity
  - View DD details for identification

---

## 👥 User Roles & Permissions

### Member (Default)
- View events in their group
- View active DDs
- Request to be a DD (if registered)
- Complete SEP verification
- Manage own profile

### Admin
- All member permissions, plus:
- Create and manage events
- Approve/reject DD requests
- Directly assign DDs
- View SEP failure alerts
- Reinstate or revoke DDs
- View all group member information

---

## 📱 Core Features

### Navigation
- **Bottom Tab Navigation**
  - Events Tab: Browse and manage events
  - DDs Tab: Find active drivers
  - Admin Tab: Admin dashboard (admins only)
  - Profile Tab: User settings and info

### Location Services
- Request location permission
- Calculate distance to active DDs
- Haversine formula for accurate distance
- Real-time distance updates

### File Storage
- **Secure Storage Buckets**
  - License photos (5MB limit, private)
  - SEP selfies (2MB limit, private)
  - SEP audio recordings (1MB limit, private)
- User-scoped access control
- Admin visibility for group members

### Profile Management
- View personal information
- See SEP baseline metrics
- Edit driver information (if DD)
- View group membership
- Logout functionality

---

## 🔒 Security & Privacy

### Data Access Control
- Row Level Security (RLS) on all tables
- Users can only access data in their group
- Admins have elevated permissions within their group
- Private file storage with signed URLs

### Privacy Features
- Location shared as distance only (not exact coordinates)
- SEP data visible only to user and admins
- Secure authentication with token management
- No cross-group data visibility

---

## 📊 Data Models

### Core Entities
- **Groups**: Fraternity/sorority organizations
- **Users**: Member profiles and DD information
- **Events**: Social events requiring DDs
- **DD Requests**: Requests to drive for events
- **DD Assignments**: Approved DD assignments
- **SEP Baselines**: User baseline measurements
- **SEP Attempts**: Verification test results
- **DD Sessions**: Active driving sessions
- **Admin Alerts**: Notifications for admins

---

## 🎨 User Experience

### Design Principles
- **Simplicity First**: Minimal UI, straightforward flows
- **Mobile-First**: Optimized for one-handed use
- **Social Enforcement**: Trust-based with admin oversight
- **Offline Tolerance**: Core flows work with intermittent connectivity

### Key Flows
1. **New User → Onboarded Member**: 5 steps, ~3 minutes
2. **DD Request → Active Session**: Request → Approval → SEP → Drive
3. **Rider → Find DD**: Select event → View DDs → Choose by distance
4. **Admin → Manage Event**: Create → Assign DDs → Monitor alerts

---

## 🚀 Technology Stack

### Frontend
- React Native (Expo)
- React Navigation
- TypeScript
- Expo Camera, Location, AV, Image Picker

### Backend
- Supabase (PostgreSQL + Auth + Storage)
- Row Level Security (RLS)
- Real-time subscriptions (future)

### Development
- Hot reload with Expo
- TypeScript for type safety
- Modular component architecture

---

## 📝 Test Data

### Pre-seeded Groups
- **Alpha Beta Gamma** - Code: `ABG2024`
- **Delta Epsilon Zeta** - Code: `DEZ2024`
- **Theta Kappa Lambda** - Code: `TKL2024`

---

## 🔮 Out of Scope (Future Enhancements)

### Not in MVP
- Push notifications
- In-app messaging
- Real-time location tracking
- ML-based SEP evaluation
- Multi-group membership
- Event check-in/check-out
- Ride history and analytics
- Social features (ratings, comments)
- Password reset flow
- Profile photo upload
- Dark mode
- Internationalization

### Technical Debt for Later
- Comprehensive error logging (Sentry)
- Offline support with local database
- End-to-end testing suite
- Bundle size optimization
- Analytics tracking
- Advanced state management
- Accessibility features
- Performance monitoring

---

## ✅ Success Criteria

### MVP is Complete When:
- [x] Database schema deployed
- [ ] Users can sign up and onboard
- [ ] Users can join groups with access codes
- [ ] DDs can register with vehicle info
- [ ] SEP baseline can be established
- [ ] Events can be created (admins)
- [ ] DD requests can be submitted and approved
- [ ] SEP verification works before sessions
- [ ] DD sessions can be started and ended
- [ ] Riders can find active DDs with distance
- [ ] Admin alerts work for SEP failures
- [ ] Profile management functional

### Demo-Ready Checklist
- [ ] 3+ test users created (1 admin, 2+ members)
- [ ] 2+ events created
- [ ] 1+ DD assigned and verified
- [ ] Active DD session running
- [ ] Distance calculation working
- [ ] SEP failure alert demonstrated
- [ ] All core flows tested end-to-end

---

## 📞 Support & Documentation

- **Setup Guide**: `SUPABASE_SETUP.md`
- **Database Schema**: `supabase/SCHEMA_REFERENCE.md`
- **Troubleshooting**: `supabase/TROUBLESHOOTING.md`
- **Design Document**: `.kiro/specs/dsober-dd-management/design.md`
- **Requirements**: `.kiro/specs/dsober-dd-management/requirements.md`
- **Implementation Tasks**: `.kiro/specs/dsober-dd-management/tasks.md`
