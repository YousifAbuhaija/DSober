# Design Document: Self-Service DD Upgrade

## Overview

This feature enables existing non-DD members to upgrade their accounts to DD status through a self-service flow. The design leverages the existing DD onboarding screens (DriverInfoScreen) but creates a new navigation path specifically for post-onboarding DD upgrades. The solution maintains consistency with the existing onboarding experience while adapting it for users who have already completed initial account setup.

### Key Design Decisions

1. **Reuse Existing Components**: Leverage the existing DriverInfoScreen component to maintain consistency and reduce code duplication
2. **Separate Navigation Stack**: Create a dedicated modal navigation stack for DD upgrade to avoid conflicts with the main onboarding flow
3. **Real-time State Updates**: Utilize the existing AuthContext real-time subscription to automatically reflect DD status changes
4. **Minimal UI Changes**: Replace the alert dialog with direct navigation while maintaining the existing visual design

## Architecture

### Navigation Flow

```
RidesScreen (Non-DD User)
    ↓ (Tap "Become a DD" button)
DDUpgradeNavigator (Modal Stack)
    ↓
DriverInfoScreen (Reused from onboarding)
    ↓ (Complete form)
Update User Record (is_dd=true, dd_status='active')
    ↓
Navigate Back to RidesScreen
    ↓
RidesScreen (Now DD User - shows DD interface)
```

### Component Architecture

```
MainAppScreen
├── RidesScreen
│   ├── renderNonDDView() [Modified]
│   │   └── Button → Navigate to DDUpgradeNavigator
│   └── renderInactiveDDView() [Shown after upgrade]
│
└── DDUpgradeNavigator [New Modal Stack]
    └── DriverInfoScreen [Reused, with mode prop]
```

## Components and Interfaces

### 1. DDUpgradeNavigator (New Component)

**Purpose**: Provides a modal navigation stack for the DD upgrade flow

**Location**: `DSober/navigation/DDUpgradeNavigator.tsx`

**Interface**:
```typescript
export type DDUpgradeStackParamList = {
  DriverInfo: { mode: 'upgrade' };
};
```

**Implementation Details**:
- Uses `createStackNavigator` from React Navigation
- Presents as a modal (can be dismissed)
- Contains only the DriverInfoScreen
- Configured with appropriate header styling

### 2. DriverInfoScreen (Modified)

**Purpose**: Collect driver information for both initial onboarding and post-onboarding upgrades

**Location**: `DSober/screens/onboarding/DriverInfoScreen.tsx`

**New Props**:
```typescript
interface DriverInfoScreenProps {
  navigation: any;
  route?: {
    params?: {
      mode?: 'onboarding' | 'upgrade';
    };
  };
}
```

**Modifications**:
- Accept optional `mode` parameter to distinguish between onboarding and upgrade flows
- When `mode === 'upgrade'`:
  - After successful save, call `refreshUser()` to update AuthContext
  - Navigate back to the previous screen (RidesScreen) instead of to ProfilePhoto
  - Show success feedback before navigation
- When `mode === 'onboarding'` or undefined:
  - Maintain existing behavior (navigate to ProfilePhoto)

**Navigation Logic**:
```typescript
// After successful save
if (mode === 'upgrade') {
  await refreshUser(); // Refresh user context
  Alert.alert(
    'Success',
    'You are now a designated driver! You can start DD sessions from events.',
    [{ 
      text: 'OK', 
      onPress: () => navigation.goBack() 
    }]
  );
} else {
  // Existing onboarding flow
  navigation.navigate('ProfilePhoto');
}
```

### 3. RidesScreen (Modified)

**Purpose**: Display ride management interface and DD upgrade call-to-action

**Location**: `DSober/screens/RidesScreen.tsx`

**Modifications to `renderNonDDView()`**:

**Before**:
```typescript
onPress={() => {
  Alert.alert(
    'Become a DD',
    'To become a DD, please contact your chapter admin...',
    [{ text: 'OK' }]
  );
}}
```

**After**:
```typescript
onPress={() => {
  navigation.navigate('DDUpgrade', { 
    screen: 'DriverInfo',
    params: { mode: 'upgrade' }
  });
}}
```

**Button Text Change**:
- Change from "Learn More" to "Get Started" to better indicate action

### 4. MainAppScreen (Modified)

**Purpose**: Root navigator for the main application

**Location**: `DSober/screens/MainAppScreen.tsx`

**Modifications**:
- Import DDUpgradeNavigator
- Add DDUpgrade screen to the stack as a modal

**New Navigation Structure**:
```typescript
<Stack.Navigator>
  {/* Existing screens */}
  <Stack.Screen name="MainTabs" component={TabNavigator} />
  
  {/* New modal screen */}
  <Stack.Screen 
    name="DDUpgrade" 
    component={DDUpgradeNavigator}
    options={{
      presentation: 'modal',
      headerShown: false,
    }}
  />
</Stack.Navigator>
```

## Data Models

### User Table Updates

No schema changes required. The feature uses existing fields:

```typescript
interface User {
  // ... existing fields
  isDD: boolean;              // Updated from false to true
  ddStatus: 'none' | 'active' | 'revoked';  // Updated from 'none' to 'active'
  carMake?: string;           // Set during upgrade
  carModel?: string;          // Set during upgrade
  carPlate?: string;          // Set during upgrade
  licensePhotoUrl?: string;   // Set during upgrade
  phoneNumber?: string;       // Optionally updated
  updatedAt: Date;            // Automatically updated
}
```

### Database Operations

**Update Query** (executed in DriverInfoScreen):
```typescript
const { error } = await supabase
  .from('users')
  .update({
    is_dd: true,
    dd_status: 'active',
    car_make: carMake.trim(),
    car_model: carModel.trim(),
    car_plate: carPlate.trim().toUpperCase(),
    license_photo_url: licensePhotoUrl,
    phone_number: formattedPhone, // if updated
    updated_at: new Date().toISOString(),
  })
  .eq('id', session.user.id);
```

## Error Handling

### Validation Errors

**Handled in DriverInfoScreen** (existing logic):
- Empty required fields → Alert with specific field name
- Invalid phone number format → Alert with format requirements
- No license photo uploaded → Alert requesting photo

### Upload Errors

**Image Upload Failure**:
```typescript
try {
  const licensePhotoUrl = await uploadImage(...);
} catch (error) {
  Alert.alert(
    'Upload Failed',
    'Failed to upload license photo. Please check your connection and try again.'
  );
  return; // Don't proceed with user update
}
```

### Database Update Errors

**User Update Failure**:
```typescript
const { error } = await supabase.from('users').update(...);

if (error) {
  console.error('DD upgrade error:', error);
  Alert.alert(
    'Update Failed',
    'Failed to update your account. Please try again or contact support.'
  );
  return;
}
```

### Permission Errors

**Photo Library Access Denied**:
```typescript
const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (status !== 'granted') {
  Alert.alert(
    'Permission Required',
    'Please grant photo library access in Settings to upload your license photo.'
  );
  return;
}
```

## State Management

### AuthContext Integration

The existing AuthContext real-time subscription automatically handles DD status updates:

```typescript
// In AuthContext.tsx (existing code)
realtimeChannel = supabase
  .channel('user-profile-changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    table: 'users',
    filter: `id=eq.${session.user.id}`,
  }, (payload) => {
    const criticalFieldsChanged = 
      oldRecord?.dd_status !== newRecord?.dd_status ||
      oldRecord?.is_dd !== newRecord?.is_dd;
    
    if (criticalFieldsChanged) {
      fetchUserProfile(session.user.id).then(setUser);
    }
  })
  .subscribe();
```

**Flow**:
1. User completes DriverInfoScreen
2. Database update occurs (is_dd, dd_status changed)
3. Real-time subscription detects critical field change
4. AuthContext automatically refreshes user profile
5. RidesScreen re-renders with updated user.isDD value
6. DD interface is displayed

### Loading States

**During Upload**:
```typescript
const [uploadingPhoto, setUploadingPhoto] = useState(false);

// In upload handler
setUploadingPhoto(true);
const url = await uploadImage(...);
setUploadingPhoto(false);

// In button
{loading ? (
  <Text>{uploadingPhoto ? 'Uploading photo...' : 'Saving...'}</Text>
) : (
  <Text>Continue</Text>
)}
```

**During Database Update**:
```typescript
const [loading, setLoading] = useState(false);

setLoading(true);
await supabase.from('users').update(...);
await refreshUser(); // Explicit refresh for immediate feedback
setLoading(false);
```

## Testing Strategy

### Unit Testing

**DriverInfoScreen Mode Logic**:
- Test that `mode='upgrade'` navigates back instead of to ProfilePhoto
- Test that `mode='onboarding'` maintains existing navigation
- Test that undefined mode defaults to onboarding behavior

**Validation Functions**:
- Test phone number validation with various formats
- Test required field validation
- Test license plate formatting (uppercase conversion)

### Integration Testing

**DD Upgrade Flow**:
1. Start as non-DD user on RidesScreen
2. Tap "Get Started" button
3. Verify navigation to DriverInfoScreen
4. Fill in all required fields
5. Upload license photo
6. Submit form
7. Verify database update
8. Verify navigation back to RidesScreen
9. Verify DD interface is displayed

**Real-time State Update**:
1. Complete DD upgrade in one session
2. Verify AuthContext subscription triggers
3. Verify user state updates without manual refresh
4. Verify UI updates to show DD interface

**Error Recovery**:
1. Test upload failure recovery
2. Test database update failure recovery
3. Test permission denial handling
4. Test network error handling

### Manual Testing Checklist

- [ ] Non-DD user sees call-to-action card on RidesScreen
- [ ] Tapping "Get Started" opens DD upgrade modal
- [ ] All form validations work correctly
- [ ] Photo upload works and shows preview
- [ ] Form submission shows loading states
- [ ] Success alert appears after completion
- [ ] User is navigated back to RidesScreen
- [ ] RidesScreen now shows DD interface
- [ ] User can start DD sessions from events
- [ ] License photo is accessible to admins
- [ ] Phone number update works correctly
- [ ] Modal can be dismissed before completion
- [ ] Dismissing modal doesn't corrupt user state

## Security Considerations

### Row Level Security (RLS)

**Existing Policies Apply**:
- Users can only update their own records
- License photos are stored in secure bucket
- Only admins can view license photos

**No New Policies Required**: The feature uses existing RLS policies that allow users to update their own profile.

### Data Validation

**Server-side Validation** (via RLS and constraints):
- User ID must match authenticated user
- Required fields enforced by NOT NULL constraints
- dd_status must be valid enum value

**Client-side Validation** (in DriverInfoScreen):
- All required fields must be filled
- Phone number must match valid format
- License photo must be uploaded
- Image must be valid format

### Storage Security

**License Photos**:
- Stored in `license-photos` bucket
- Path: `{user_id}/license.jpg`
- Access controlled by storage policies
- Only accessible to user and admins

## Performance Considerations

### Image Upload Optimization

**Existing Implementation** (maintained):
- Images compressed to 0.8 quality
- Aspect ratio maintained at 4:3
- Allows editing before upload

### Real-time Subscription Efficiency

**Existing Implementation** (maintained):
- Only triggers on critical field changes (is_dd, dd_status)
- Prevents unnecessary refreshes during form filling
- Single subscription per user session

### Navigation Performance

**Modal Presentation**:
- Uses native modal presentation for smooth animation
- Lazy loads DriverInfoScreen only when needed
- Properly cleans up when dismissed

## Accessibility

### Screen Reader Support

**Existing Implementation** (maintained in DriverInfoScreen):
- All form inputs have labels
- Error messages are announced
- Loading states are announced
- Success feedback is announced

**RidesScreen Updates**:
- Button text "Get Started" is more descriptive than "Learn More"
- Call-to-action card maintains existing accessibility labels

### Keyboard Navigation

- All form inputs are keyboard accessible
- Tab order follows logical flow
- Submit button is reachable via keyboard

### Visual Accessibility

**Existing Implementation** (maintained):
- High contrast text and backgrounds
- Minimum touch target sizes (44x44 points)
- Clear visual feedback for all interactions
- Loading indicators for async operations

## Migration and Rollout

### No Database Migration Required

This feature uses existing database schema and columns. No migration scripts needed.

### Feature Flag (Optional)

If gradual rollout is desired:

```typescript
// In RidesScreen.tsx
const DD_UPGRADE_ENABLED = true; // or from config

const renderNonDDView = () => {
  if (!user?.isDD) {
    return (
      <TouchableOpacity
        onPress={() => {
          if (DD_UPGRADE_ENABLED) {
            navigation.navigate('DDUpgrade', { 
              screen: 'DriverInfo',
              params: { mode: 'upgrade' }
            });
          } else {
            // Old behavior
            Alert.alert(...);
          }
        }}
      >
        <Text>{DD_UPGRADE_ENABLED ? 'Get Started' : 'Learn More'}</Text>
      </TouchableOpacity>
    );
  }
};
```

### Rollback Plan

If issues arise:
1. Set feature flag to false (if implemented)
2. Revert RidesScreen changes to show alert dialog
3. No database rollback needed (DD upgrades remain valid)
4. Users who upgraded can still function as DDs

## Future Enhancements

### Admin Approval Flow (Optional)

If admin approval is desired before DD activation:
1. Add `dd_status: 'pending_approval'` state
2. Create admin review interface
3. Send notification to admins on new DD request
4. Update status to 'active' after approval

### Profile Completion Tracking

Track which users complete DD upgrade:
1. Add analytics event on upgrade completion
2. Monitor conversion rate from view to completion
3. Identify drop-off points in the flow

### Re-verification Flow

For DDs who need to update their information:
1. Add "Update Driver Info" option in profile settings
2. Reuse DriverInfoScreen with pre-filled data
3. Allow updating vehicle info and license photo
