# Requirements Document

## Introduction

This feature enables existing non-DD members to upgrade their accounts to DD status through a self-service onboarding process. Currently, non-DD users must contact an admin to become a DD. This feature will allow them to initiate and complete the DD onboarding flow directly from the Rides screen, providing vehicle information and driver's license verification, after which their account will be automatically upgraded to DD status.

## Glossary

- **DD**: Designated Driver - a verified member who can provide rides during events
- **Non-DD User**: A member who is not currently a designated driver (is_dd = false)
- **DD Onboarding Flow**: The sequence of screens that collect driver information (vehicle details, license photo)
- **Rides Screen**: The main screen where users view and manage ride requests
- **User Account**: The database record in the users table containing member information
- **DD Status**: The dd_status field in the users table ('none', 'active', or 'revoked')
- **System**: The DSober mobile application

## Requirements

### Requirement 1

**User Story:** As a non-DD member, I want to initiate the DD upgrade process from the Rides screen, so that I can become a designated driver without contacting an admin

#### Acceptance Criteria

1. WHEN a non-DD user views the Rides screen, THE System SHALL display a call-to-action card with a button to begin DD onboarding
2. WHEN a non-DD user taps the "Become a DD" button, THE System SHALL navigate the user to the DD onboarding flow
3. THE System SHALL replace the current alert dialog with direct navigation to the onboarding flow
4. THE System SHALL maintain the existing visual design of the call-to-action card

### Requirement 2

**User Story:** As a non-DD member going through DD upgrade, I want to provide my vehicle information and driver's license, so that I can be verified as a designated driver

#### Acceptance Criteria

1. WHEN a user enters the DD upgrade flow, THE System SHALL present the driver information collection screen
2. THE System SHALL require the user to provide car make, car model, and license plate number
3. THE System SHALL require the user to upload a photo of their driver's license
4. THE System SHALL validate that all required fields are completed before allowing progression
5. THE System SHALL store the uploaded license photo in the license-photos storage bucket
6. THE System SHALL allow the user to update their phone number if needed during the flow

### Requirement 3

**User Story:** As a non-DD member completing DD upgrade, I want my account to be automatically upgraded to DD status, so that I can immediately start providing rides

#### Acceptance Criteria

1. WHEN a user successfully completes the driver information form, THE System SHALL update the user's is_dd field to true
2. WHEN a user successfully completes the driver information form, THE System SHALL update the user's dd_status field to 'active'
3. WHEN a user successfully completes the driver information form, THE System SHALL save the vehicle information to the users table
4. WHEN a user successfully completes the driver information form, THE System SHALL save the license photo URL to the users table
5. THE System SHALL refresh the user context to reflect the updated DD status
6. WHEN the account upgrade is complete, THE System SHALL navigate the user back to the Rides screen

### Requirement 4

**User Story:** As a newly upgraded DD, I want to see the DD-specific interface on the Rides screen, so that I can start managing ride requests

#### Acceptance Criteria

1. WHEN a user returns to the Rides screen after DD upgrade, THE System SHALL display the DD interface instead of the non-DD call-to-action
2. THE System SHALL show the "No Active DD Session" view for newly upgraded DDs
3. THE System SHALL allow the newly upgraded DD to navigate to events to start a DD session
4. THE System SHALL reflect the updated DD status in real-time through the AuthContext subscription

### Requirement 5

**User Story:** As a user going through DD upgrade, I want clear feedback during the process, so that I understand what information is required and when errors occur

#### Acceptance Criteria

1. WHEN a user fails to complete a required field, THE System SHALL display an error alert with a clear message
2. WHEN a user uploads an invalid image format, THE System SHALL display an error message
3. WHEN the license photo is uploading, THE System SHALL display a loading indicator with "Uploading photo..." text
4. WHEN the account update is in progress, THE System SHALL display a loading indicator and disable the submit button
5. IF an error occurs during account update, THE System SHALL display an error alert and allow the user to retry

### Requirement 6

**User Story:** As a system administrator, I want DD upgrades to follow the same data validation and security rules as initial DD onboarding, so that all DDs meet the same standards

#### Acceptance Criteria

1. THE System SHALL use the same validation logic for vehicle information as the initial onboarding flow
2. THE System SHALL use the same image upload and storage mechanism as the initial onboarding flow
3. THE System SHALL enforce the same phone number format validation as the initial onboarding flow
4. THE System SHALL apply the same RLS policies for updating user records
5. THE System SHALL store license photos with the same security and access controls as initial onboarding
