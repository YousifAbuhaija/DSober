# Requirements Document

## Introduction

This feature addresses a critical bug in the user signup and onboarding flow where users are forced to complete the basic information form (name, birthday, gender, phone number) multiple times. The issue stems from the database trigger that auto-creates user profiles with empty/default values upon signup, which conflicts with the profile completion logic that checks for the presence of these values.

## Glossary

- **User Profile**: A record in the `users` table containing user information including name, birthday, gender, phone number, group membership, and DD status
- **Profile Trigger**: The database trigger `handle_new_user()` that automatically creates a user profile when a new auth user is created
- **Profile Completion Check**: The logic in `RootNavigator.tsx` that determines whether a user has completed onboarding by checking for required profile fields
- **Onboarding Flow**: The multi-step process where new users provide their information (BasicInfo → GroupJoin → DDInterest → ProfilePhoto → SEP)
- **Auth Context**: The React context that manages authentication state and user profile data

## Requirements

### Requirement 1

**User Story:** As a new user signing up for DSober, I want to complete my basic information only once, so that I don't have to re-enter my details multiple times during onboarding

#### Acceptance Criteria

1. WHEN a new user signs up via Supabase Auth, THE Profile Trigger SHALL NOT create a user profile record with pre-filled default values
2. WHEN a new user completes the BasicInfo screen for the first time, THE System SHALL create the user profile record with the provided information
3. IF a user navigates away from the onboarding flow before completion, THEN THE System SHALL preserve their progress and not require re-entry of previously saved information
4. WHEN the Profile Completion Check evaluates a user's profile, THE System SHALL correctly identify whether basic information has been provided
5. THE System SHALL ensure that users complete the BasicInfo screen exactly once during the signup process

### Requirement 2

**User Story:** As a developer, I want the profile creation logic to be consistent and predictable, so that the onboarding flow works reliably without race conditions

#### Acceptance Criteria

1. THE Profile Trigger SHALL either be removed or modified to not create profiles with placeholder data
2. WHEN a user's profile does not exist in the database, THE Profile Completion Check SHALL correctly identify this state
3. THE BasicInfo screen SHALL handle both profile creation (INSERT) and profile updates (UPDATE) appropriately
4. THE Auth Context SHALL correctly fetch and cache user profile data after profile creation
5. THE System SHALL not rely on timing delays or polling to detect profile creation

### Requirement 3

**User Story:** As a user who has partially completed onboarding, I want to resume from where I left off, so that I don't lose my progress

#### Acceptance Criteria

1. WHEN a user has completed BasicInfo but not subsequent steps, THE Profile Completion Check SHALL direct them to the next incomplete step
2. THE System SHALL persist all user-provided information immediately upon submission of each onboarding screen
3. IF the app is closed and reopened during onboarding, THEN THE System SHALL resume onboarding at the appropriate step based on completed fields
4. THE Profile Completion Check SHALL evaluate all required fields (name, groupId, DD info if applicable, SEP baseline) to determine completion status
5. THE System SHALL not show completed onboarding steps again unless explicitly requested by the user
