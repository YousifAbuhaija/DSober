# DSober Architecture

## Overview

DSober is a mobile-first application built for iOS and Android using React Native and Expo. The architecture follows a client-server model with Supabase providing backend services including authentication, database, and file storage.

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Application                       │
│                   (React Native + Expo)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  UI Layer    │  │  Navigation  │  │    State     │      │
│  │  Components  │→ │    Layer     │→ │  Management  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                                      ↓             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           API Layer (Supabase Client)                │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                    │
└─────────┼────────────────────────────────────────────────────┘
          ↓
┌─────────┼────────────────────────────────────────────────────┐
│         ↓              Supabase Backend                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     Auth     │  │  PostgreSQL  │  │   Storage    │      │
│  │   Service    │  │   Database   │  │   Buckets    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           ↓                                   │
│                    ┌──────────────┐                          │
│                    │  Row Level   │                          │
│                    │   Security   │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
          ↑
┌─────────┼────────────────────────────────────────────────────┐
│         ↑              Device APIs                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Camera    │  │   Location   │  │    Audio     │      │
│  │ expo-camera  │  │expo-location │  │   expo-av    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend (Mobile App)

#### Core Framework
- **React Native** `0.81.5` - Cross-platform mobile framework
- **Expo** `~54.0.23` - Development platform and tooling
- **TypeScript** `~5.9.2` - Type-safe JavaScript
- **React** `19.1.0` - UI library

#### Navigation
- **React Navigation** `^7.1.20` - Navigation framework
  - `@react-navigation/stack` `^7.6.4` - Stack navigator
  - `@react-navigation/bottom-tabs` `^7.8.5` - Tab navigator
- **react-native-screens** `^4.18.0` - Native screen optimization
- **react-native-gesture-handler** `^2.29.1` - Touch gesture handling
- **react-native-safe-area-context** `^5.6.2` - Safe area management

#### Device APIs
- **expo-camera** `^17.0.9` - Camera access for selfies
- **expo-location** `^19.0.7` - GPS location services
- **expo-av** `^16.0.7` - Audio recording for phrase tests
- **expo-image-picker** `^17.0.8` - Image selection and upload
- **expo-status-bar** `~3.0.8` - Status bar styling

#### State & Storage
- **React Context + Hooks** - Built-in state management
- **@react-native-async-storage/async-storage** `^2.2.0` - Local storage

### Backend (Supabase)

#### Database
- **PostgreSQL** - Relational database
  - 9 tables with foreign key relationships
  - Row Level Security (RLS) for access control
  - Triggers for automatic timestamps
  - Indexes for query optimization

#### Authentication
- **Supabase Auth** - User authentication service
  - Email/password authentication
  - JWT token management
  - Automatic token refresh
  - Session persistence

#### Storage
- **Supabase Storage** - File storage service
  - 3 private buckets (license-photos, sep-selfies, sep-audio)
  - Signed URLs for secure access
  - File size limits and MIME type validation
  - User-scoped access policies

#### API Client
- **@supabase/supabase-js** `^2.81.1` - JavaScript client library
- **react-native-url-polyfill** `^3.0.0` - URL API polyfill

### Development Tools

- **ts-node** `^10.9.2` - TypeScript execution for scripts
- **dotenv** `^16.6.1` - Environment variable management
- **@types/react** `~19.1.0` - TypeScript definitions

---

## Application Layers

### 1. UI Layer

**Responsibility**: Render user interface and handle user interactions

**Components**:
- Screen components (AuthScreen, EventsListScreen, etc.)
- Reusable UI components (buttons, inputs, cards)
- Layout components (headers, tabs, modals)

**Technologies**:
- React Native components (View, Text, TouchableOpacity, etc.)
- Custom styled components
- Expo UI components

### 2. Navigation Layer

**Responsibility**: Manage app navigation and screen flow

**Structure**:
```
Root Navigator
├── Auth Stack (login/signup)
├── Onboarding Stack (5 steps)
└── Main Tabs
    ├── Events Tab Stack
    ├── DDs Tab Stack
    ├── Admin Tab Stack
    └── Profile Tab Stack
```

**Technologies**:
- React Navigation v7
- Stack Navigator for hierarchical flows
- Bottom Tab Navigator for main sections

### 3. State Management Layer

**Responsibility**: Manage application state and business logic

**Patterns**:
- **React Context** for global state (user, auth)
- **useState/useReducer** for local component state
- **useEffect** for side effects and data fetching
- **Custom hooks** for reusable logic

**State Categories**:
- Authentication state (user session, tokens)
- User profile state (name, group, role, DD status)
- Navigation state (current screen, params)
- UI state (loading, errors, modals)

### 4. API Layer

**Responsibility**: Interface with Supabase backend services

**Modules**:
- **Auth API**: Login, signup, logout, session management
- **Database API**: CRUD operations on all tables
- **Storage API**: File upload, download, delete
- **Realtime API**: (Future) Live updates and subscriptions

**Implementation**:
```typescript
// Supabase client initialization
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
```

---

## Data Flow

### Authentication Flow
```
User Input → AuthScreen → Supabase Auth → JWT Token → 
AsyncStorage → Context Provider → Protected Routes
```

### Data Fetching Flow
```
Component Mount → useEffect → Supabase Query → 
RLS Check → Data Return → State Update → UI Render
```

### File Upload Flow
```
Device API (Camera/Picker) → Local URI → 
Supabase Storage Upload → Public URL → 
Database Record Update → UI Update
```

### SEP Verification Flow
```
User Action → Device Tests (Camera/Audio/Touch) → 
Local Calculation → Baseline Comparison → 
Result Evaluation → Database Insert → 
Session Creation OR Alert Generation
```

---

## Security Architecture

### Authentication Security
- JWT tokens stored in AsyncStorage
- Automatic token refresh before expiration
- Secure HTTPS communication
- No sensitive data in client code

### Data Access Security
- **Row Level Security (RLS)** on all tables
- Policies enforce group-based access
- Helper functions prevent circular dependencies:
  - `public.get_user_group_id()` - Get user's group
  - `public.is_user_admin()` - Check admin status

### File Storage Security
- Private buckets (not publicly accessible)
- Signed URLs with expiration
- User-scoped upload/read policies
- Admin read access for group members
- File size and MIME type validation

### Network Security
- All API calls over HTTPS
- Supabase anon key (not service_role key)
- No API keys in source code (environment variables)

---

## Database Architecture

### Schema Design

**9 Core Tables**:
1. `groups` - Organizations
2. `users` - User profiles (extends auth.users)
3. `events` - Social events
4. `dd_requests` - DD requests
5. `dd_assignments` - DD assignments
6. `sep_baselines` - Baseline measurements
7. `sep_attempts` - Verification attempts
8. `dd_sessions` - Active sessions
9. `admin_alerts` - Admin notifications

**Relationships**:
- Groups → Users (1:N)
- Users → Events (1:N, creator)
- Events → DD Requests (1:N)
- Events → DD Assignments (1:N)
- Users → SEP Baseline (1:1)
- Users → SEP Attempts (1:N)
- Users → DD Sessions (1:N)

**Indexes**:
- Foreign keys indexed for join performance
- Status fields indexed for filtering
- Date fields indexed for sorting

### Storage Buckets

**3 Private Buckets**:
1. `license-photos` - 5MB limit, images only
2. `sep-selfies` - 2MB limit, images only
3. `sep-audio` - 1MB limit, audio only

**Path Structure**:
- `{bucket}/{userId}/{filename}`
- User-scoped for easy access control

---

## Performance Considerations

### Optimization Strategies

1. **Image Optimization**
   - Compress images before upload (max 1024x1024)
   - Use thumbnail URLs for list views
   - Lazy load images

2. **Query Optimization**
   - Select specific columns (not SELECT *)
   - Use indexes for common queries
   - Implement pagination for large lists

3. **Location Updates**
   - Only fetch location when DDs tab is active
   - Throttle distance recalculations (every 10 seconds)
   - Cache user's group info in context

4. **Audio Recording**
   - Limit phrase recording to 30 seconds max
   - Use compressed audio format (m4a)

5. **Network Efficiency**
   - Batch related queries when possible
   - Cache static data (group info, baseline)
   - Implement retry logic for failed requests

---

## Scalability Considerations

### Current MVP Limitations
- Single region deployment
- No CDN for file storage
- No caching layer
- Synchronous processing

### Future Scalability Improvements
- **Database**: Connection pooling, read replicas
- **Storage**: CDN integration, multi-region buckets
- **Caching**: Redis for session data, query results
- **Processing**: Background jobs for heavy operations
- **Monitoring**: Performance tracking, error logging

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Verify database setup
npm run verify-db
```

### Environment Configuration
```env
# .env file
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Build & Deploy
- **Development**: Expo Go app for testing
- **Production**: EAS Build for app stores
- **Backend**: Supabase hosted (no deployment needed)

---

## Error Handling Strategy

### Error Categories
1. **Network Errors**: Retry with exponential backoff
2. **Authentication Errors**: Redirect to login
3. **Permission Errors**: Show settings link
4. **Validation Errors**: Display field-specific messages
5. **Business Logic Errors**: User-friendly error messages

### Error Handling Pattern
```typescript
try {
  await supabase.from('events').insert(eventData);
} catch (error) {
  handleError(error, 'CreateEvent');
}
```

---

## Testing Strategy

### Unit Testing
- SEP evaluation logic
- Distance calculation
- Data validation functions

### Integration Testing
- Onboarding flow
- SEP verification flow
- DD request/approval flow

### Manual Testing
- Device-specific features (camera, location, audio)
- Cross-platform compatibility (iOS/Android)
- Network conditions (offline, slow connection)

---

## Monitoring & Observability

### Current MVP
- Console logging for debugging
- Supabase dashboard for database monitoring
- Expo dev tools for app debugging

### Future Improvements
- Error tracking (Sentry)
- Analytics (Amplitude, Mixpanel)
- Performance monitoring (Firebase Performance)
- User session recording
- Crash reporting

---

## Deployment Architecture

### Mobile App
- **Development**: Expo Go (instant updates)
- **Staging**: EAS Update (OTA updates)
- **Production**: App Store + Google Play

### Backend (Supabase)
- **Hosting**: Supabase Cloud (managed)
- **Database**: PostgreSQL (managed)
- **Storage**: S3-compatible (managed)
- **CDN**: Supabase CDN (managed)

### CI/CD
- **Version Control**: Git
- **Build**: EAS Build
- **Distribution**: EAS Submit
- **Updates**: EAS Update (OTA)

---

## Architecture Decisions

### Why React Native + Expo?
- Cross-platform (iOS + Android) from single codebase
- Rich ecosystem of libraries and tools
- Fast development with hot reload
- Easy access to device APIs
- Good performance for MVP

### Why Supabase?
- PostgreSQL (powerful, familiar SQL)
- Built-in authentication
- Row Level Security for data access control
- File storage included
- Real-time capabilities (future)
- Generous free tier
- Fast setup for hackathon

### Why Context over Redux?
- Simpler for MVP scope
- Built-in to React
- Less boilerplate
- Sufficient for current state needs
- Can migrate to Redux/Zustand later if needed

### Why Stack + Tab Navigation?
- Stack for hierarchical flows (onboarding, event details)
- Tabs for main sections (events, DDs, admin, profile)
- Native feel on both platforms
- Easy to implement and maintain

---

## Future Architecture Enhancements

### Short-term (Post-MVP)
- Add Redux/Zustand for complex state
- Implement offline-first with local database
- Add push notifications
- Implement real-time updates

### Long-term
- Microservices for heavy processing
- GraphQL API layer
- ML model for SEP evaluation
- WebSocket for real-time features
- Multi-region deployment
- Advanced caching strategies

---

## References

- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Navigation Documentation](https://reactnavigation.org/)
- Design Document: `.kiro/specs/dsober-dd-management/design.md`
- Database Schema: `supabase/SCHEMA_REFERENCE.md`
