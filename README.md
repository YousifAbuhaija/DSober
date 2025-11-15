# DSober - Designated Driver Management Platform

A React Native mobile application built with Expo for managing designated drivers in fraternities and sororities through a sobriety verification system.

## Prerequisites

- Node.js (v20.18.0 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator
- Supabase account

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a new project in [Supabase](https://supabase.com)
2. Copy your project URL and anon key
3. Update the `.env` file with your credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set Up Database Schema

Run the SQL scripts in your Supabase SQL editor to create the required tables and RLS policies. See the design document for the complete schema.

### 4. Run the Application

```bash
# Start the Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## Project Structure

```
DSober/
├── lib/
│   └── supabase.ts          # Supabase client configuration
├── types/
│   └── database.types.ts    # TypeScript type definitions
├── App.tsx                  # Main application entry point
├── .env                     # Environment variables (not committed)
├── .env.example             # Example environment variables
└── package.json             # Project dependencies
```

## Dependencies

### Core
- React Native (via Expo)
- TypeScript
- @supabase/supabase-js

### Navigation
- @react-navigation/native
- @react-navigation/stack
- @react-navigation/bottom-tabs

### Device APIs
- expo-location
- expo-image-picker
- expo-camera
- expo-av

### Storage
- @react-native-async-storage/async-storage

## Features

- User authentication with email/password
- Onboarding flow with SEP baseline establishment
- Event creation and management
- DD request and approval workflow
- SEP verification before DD sessions
- Active DD discovery with distance calculation
- Admin dashboard for managing requests and alerts
- Profile management

## Next Steps

After completing this setup, you can begin implementing the features according to the tasks outlined in `.kiro/specs/dsober-dd-management/tasks.md`.

## Documentation

- [Requirements Document](.kiro/specs/dsober-dd-management/requirements.md)
- [Design Document](.kiro/specs/dsober-dd-management/design.md)
- [Implementation Tasks](.kiro/specs/dsober-dd-management/tasks.md)
