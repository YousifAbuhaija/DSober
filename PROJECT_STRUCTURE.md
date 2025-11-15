# DSober Project Structure

## Overview
This document describes the initial project structure and setup completed in Task 1.

## Directory Structure

```
DSober/
├── .env                      # Environment variables (not committed to git)
├── .env.example              # Example environment variables template
├── .gitignore                # Git ignore rules
├── App.tsx                   # Main application entry point
├── README.md                 # Project documentation
├── SUPABASE_SETUP.md         # Supabase configuration guide
├── PROJECT_STRUCTURE.md      # This file
├── package.json              # NPM dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── app.json                  # Expo configuration
├── index.ts                  # Entry point
│
├── lib/
│   └── supabase.ts           # Supabase client configuration
│
├── types/
│   └── database.types.ts     # TypeScript type definitions for database
│
├── assets/                   # Static assets (images, icons)
│
└── .kiro/
    └── specs/
        └── dsober-dd-management/
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

## Installed Dependencies

### Core Dependencies
- **expo**: ~54.0.23 - React Native framework
- **react**: 19.1.0 - UI library
- **react-native**: 0.81.5 - Mobile framework
- **typescript**: ~5.9.2 - Type safety

### Supabase & Storage
- **@supabase/supabase-js**: ^2.81.1 - Supabase client
- **@react-native-async-storage/async-storage**: ^2.2.0 - Persistent storage
- **react-native-url-polyfill**: ^3.0.0 - URL polyfill for React Native

### Navigation
- **@react-navigation/native**: ^7.1.20 - Navigation core
- **@react-navigation/stack**: ^7.6.4 - Stack navigator
- **@react-navigation/bottom-tabs**: ^7.8.5 - Bottom tab navigator
- **react-native-screens**: ^4.18.0 - Native screen components
- **react-native-safe-area-context**: ^5.6.2 - Safe area handling
- **react-native-gesture-handler**: ^2.29.1 - Gesture handling

### Device APIs
- **expo-location**: ^19.0.7 - Location services
- **expo-image-picker**: ^17.0.8 - Image picker
- **expo-camera**: ^17.0.9 - Camera access
- **expo-av**: ^16.0.7 - Audio/video playback and recording

## Configuration Files

### .env
Contains Supabase credentials (not committed to git):
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### lib/supabase.ts
Configures the Supabase client with:
- AsyncStorage for session persistence
- Auto token refresh
- Session detection disabled (mobile app)

### types/database.types.ts
TypeScript interfaces for all database tables:
- User, Group, Event
- DDRequest, DDAssignment
- SEPBaseline, SEPAttempt
- DDSession, AdminAlert

## NPM Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator/device
- `npm run ios` - Run on iOS simulator/device
- `npm run web` - Run in web browser

## Next Steps

1. Configure Supabase credentials in `.env` file
2. Set up database schema in Supabase (see SUPABASE_SETUP.md)
3. Create storage buckets for images and audio
4. Begin implementing Task 2: Set up database schema and RLS policies

## Notes

- The project uses TypeScript for type safety
- Expo is configured for cross-platform development (iOS, Android, Web)
- All sensitive credentials are stored in `.env` and excluded from git
- The Supabase client is configured with proper session management
