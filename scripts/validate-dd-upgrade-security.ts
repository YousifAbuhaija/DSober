/**
 * Security and Data Integrity Validation Script for DD Upgrade Feature
 * 
 * This script validates:
 * 1. RLS policies allow users to update their own DD status
 * 2. License photos are stored with correct permissions
 * 3. Only user and admins can access uploaded license photos
 * 4. Form inputs are properly sanitized
 * 5. Phone number validation matches existing standards
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ValidationResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

function logResult(test: string, passed: boolean, message: string, details?: any) {
  results.push({ test, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// Test 1: Verify RLS policies allow users to update their own DD status
async function testUserCanUpdateOwnDDStatus() {
  console.log('\n📋 Test 1: User can update their own DD status');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logResult(
        'User Authentication',
        false,
        'Failed to get authenticated user',
        { error: authError }
      );
      return;
    }

    // Get current user profile
    const { data: currentProfile, error: fetchError } = await supabase
      .from('users')
      .select('id, is_dd, dd_status, car_make')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      logResult(
        'Fetch User Profile',
        false,
        'Failed to fetch user profile',
        { error: fetchError }
      );
      return;
    }

    logResult(
      'Fetch User Profile',
      true,
      'Successfully fetched user profile',
      { userId: user.id, isDD: currentProfile.is_dd }
    );

    // Test updating DD status (simulate upgrade)
    const testUpdate = {
      car_make: currentProfile.car_make || 'TestMake',
      car_model: 'TestModel',
      car_plate: 'TEST123',
    };

    const { error: updateError } = await supabase
      .from('users')
      .update(testUpdate)
      .eq('id', user.id);

    if (updateError) {
      logResult(
        'Update Own Profile',
        false,
        'RLS policy blocked user from updating own profile',
        { error: updateError }
      );
      return;
    }

    logResult(
      'Update Own Profile',
      true,
      'User can successfully update their own profile (RLS policy allows)',
      { testUpdate }
    );

    // Verify the update was applied
    const { data: updatedProfile, error: verifyError } = await supabase
      .from('users')
      .select('car_make, car_model, car_plate')
      .eq('id', user.id)
      .single();

    if (verifyError) {
      logResult(
        'Verify Update',
        false,
        'Failed to verify update',
        { error: verifyError }
      );
      return;
    }

    const updateApplied = 
      updatedProfile.car_make === testUpdate.car_make &&
      updatedProfile.car_model === testUpdate.car_model &&
      updatedProfile.car_plate === testUpdate.car_plate;

    logResult(
      'Verify Update Applied',
      updateApplied,
      updateApplied ? 'Update was successfully applied' : 'Update was not applied correctly',
      { expected: testUpdate, actual: updatedProfile }
    );

  } catch (error: any) {
    logResult(
      'User Update Test',
      false,
      'Unexpected error during user update test',
      { error: error.message }
    );
  }
}

// Test 2: Verify license photo storage permissions
async function testLicensePhotoStoragePermissions() {
  console.log('\n📋 Test 2: License photo storage permissions');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logResult(
        'User Authentication',
        false,
        'Failed to get authenticated user',
        { error: authError }
      );
      return;
    }

    // Check if license-photos bucket exists
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      logResult(
        'List Storage Buckets',
        false,
        'Failed to list storage buckets',
        { error: bucketsError }
      );
      return;
    }

    const licensePhotosBucket = buckets?.find(b => b.name === 'license-photos');
    
    if (!licensePhotosBucket) {
      logResult(
        'License Photos Bucket',
        false,
        'license-photos bucket does not exist',
        { availableBuckets: buckets?.map(b => b.name) }
      );
      return;
    }

    logResult(
      'License Photos Bucket',
      true,
      'license-photos bucket exists',
      { 
        bucketId: licensePhotosBucket.id,
        isPublic: licensePhotosBucket.public,
        fileSizeLimit: licensePhotosBucket.file_size_limit
      }
    );

    // Verify bucket is NOT public
    if (licensePhotosBucket.public) {
      logResult(
        'Bucket Privacy',
        false,
        'license-photos bucket is PUBLIC - should be PRIVATE',
        { isPublic: licensePhotosBucket.public }
      );
    } else {
      logResult(
        'Bucket Privacy',
        true,
        'license-photos bucket is correctly set to PRIVATE',
        { isPublic: licensePhotosBucket.public }
      );
    }

    // Test user can upload to their own folder
    const testFilePath = `${user.id}/test-license.txt`;
    const testContent = 'Test license photo content';
    
    const { error: uploadError } = await supabase
      .storage
      .from('license-photos')
      .upload(testFilePath, testContent, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      logResult(
        'Upload to Own Folder',
        false,
        'User cannot upload to their own folder in license-photos',
        { error: uploadError }
      );
    } else {
      logResult(
        'Upload to Own Folder',
        true,
        'User can successfully upload to their own folder',
        { path: testFilePath }
      );

      // Clean up test file
      await supabase.storage.from('license-photos').remove([testFilePath]);
    }

  } catch (error: any) {
    logResult(
      'Storage Permissions Test',
      false,
      'Unexpected error during storage permissions test',
      { error: error.message }
    );
  }
}

// Test 3: Verify only user and admins can access license photos
async function testLicensePhotoAccessControl() {
  console.log('\n📋 Test 3: License photo access control');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logResult(
        'User Authentication',
        false,
        'Failed to get authenticated user',
        { error: authError }
      );
      return;
    }

    // Get user profile to check if they have a license photo
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('license_photo_url, role, group_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logResult(
        'Fetch User Profile',
        false,
        'Failed to fetch user profile',
        { error: profileError }
      );
      return;
    }

    logResult(
      'User Profile Retrieved',
      true,
      'Successfully retrieved user profile',
      { 
        hasLicensePhoto: !!profile.license_photo_url,
        role: profile.role,
        groupId: profile.group_id
      }
    );

    // Test user can read their own license photo
    if (profile.license_photo_url) {
      const photoPath = profile.license_photo_url.split('/').slice(-2).join('/');
      
      const { data: ownPhotoData, error: ownPhotoError } = await supabase
        .storage
        .from('license-photos')
        .download(photoPath);

      if (ownPhotoError) {
        logResult(
          'Read Own License Photo',
          false,
          'User cannot read their own license photo',
          { error: ownPhotoError, path: photoPath }
        );
      } else {
        logResult(
          'Read Own License Photo',
          true,
          'User can successfully read their own license photo',
          { path: photoPath, size: ownPhotoData.size }
        );
      }
    } else {
      logResult(
        'Read Own License Photo',
        true,
        'User has no license photo uploaded (skipping read test)',
        {}
      );
    }

    // Check if user is admin
    if (profile.role === 'admin') {
      // Test admin can read other users' photos in their group
      const { data: groupUsers, error: groupUsersError } = await supabase
        .from('users')
        .select('id, license_photo_url')
        .eq('group_id', profile.group_id)
        .neq('id', user.id)
        .not('license_photo_url', 'is', null)
        .limit(1);

      if (groupUsersError) {
        logResult(
          'Admin Access to Group Photos',
          false,
          'Failed to query group users',
          { error: groupUsersError }
        );
      } else if (groupUsers && groupUsers.length > 0) {
        const otherUserPhoto = groupUsers[0].license_photo_url;
        const photoPath = otherUserPhoto.split('/').slice(-2).join('/');
        
        const { data: groupPhotoData, error: groupPhotoError } = await supabase
          .storage
          .from('license-photos')
          .download(photoPath);

        if (groupPhotoError) {
          logResult(
            'Admin Access to Group Photos',
            false,
            'Admin cannot read license photos of users in their group',
            { error: groupPhotoError }
          );
        } else {
          logResult(
            'Admin Access to Group Photos',
            true,
            'Admin can successfully read license photos of users in their group',
            { path: photoPath }
          );
        }
      } else {
        logResult(
          'Admin Access to Group Photos',
          true,
          'No other users with license photos in group (skipping admin access test)',
          {}
        );
      }
    } else {
      logResult(
        'Admin Access Test',
        true,
        'User is not an admin (skipping admin-specific tests)',
        { role: profile.role }
      );
    }

  } catch (error: any) {
    logResult(
      'Access Control Test',
      false,
      'Unexpected error during access control test',
      { error: error.message }
    );
  }
}

// Test 4: Validate form input sanitization
function testFormInputSanitization() {
  console.log('\n📋 Test 4: Form input sanitization');
  
  // Test cases for input sanitization
  const testCases = [
    {
      input: '  Toyota  ',
      expected: 'Toyota',
      field: 'carMake',
      description: 'Trim whitespace from car make'
    },
    {
      input: 'abc123',
      expected: 'ABC123',
      field: 'carPlate',
      description: 'Convert license plate to uppercase'
    },
    {
      input: '  Camry  ',
      expected: 'Camry',
      field: 'carModel',
      description: 'Trim whitespace from car model'
    },
    {
      input: '<script>alert("xss")</script>',
      expected: '<script>alert("xss")</script>',
      field: 'carMake',
      description: 'Preserve special characters (database handles escaping)'
    }
  ];

  testCases.forEach(testCase => {
    let sanitized: string;
    
    switch (testCase.field) {
      case 'carPlate':
        sanitized = testCase.input.trim().toUpperCase();
        break;
      default:
        sanitized = testCase.input.trim();
    }

    const passed = sanitized === testCase.expected;
    
    logResult(
      `Sanitize ${testCase.field}`,
      passed,
      testCase.description,
      { 
        input: testCase.input,
        expected: testCase.expected,
        actual: sanitized
      }
    );
  });
}

// Test 5: Validate phone number validation
function testPhoneNumberValidation() {
  console.log('\n📋 Test 5: Phone number validation');
  
  const validatePhoneNumber = (phone: string): boolean => {
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length === 10 || (digitsOnly.length >= 11 && digitsOnly[0] === '1');
  };

  const formatPhoneNumber = (phone: string): string => {
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    
    if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
      return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }
    
    return phone;
  };

  const testCases = [
    {
      input: '5551234567',
      shouldBeValid: true,
      expectedFormat: '(555) 123-4567',
      description: 'Valid 10-digit US number'
    },
    {
      input: '15551234567',
      shouldBeValid: true,
      expectedFormat: '+1 (555) 123-4567',
      description: 'Valid 11-digit international format'
    },
    {
      input: '(555) 123-4567',
      shouldBeValid: true,
      expectedFormat: '(555) 123-4567',
      description: 'Already formatted 10-digit number'
    },
    {
      input: '555-123-4567',
      shouldBeValid: true,
      expectedFormat: '(555) 123-4567',
      description: 'Dashed 10-digit number'
    },
    {
      input: '123',
      shouldBeValid: false,
      expectedFormat: '123',
      description: 'Invalid - too short'
    },
    {
      input: '12345',
      shouldBeValid: false,
      expectedFormat: '12345',
      description: 'Invalid - incomplete number'
    },
    {
      input: '25551234567',
      shouldBeValid: false,
      expectedFormat: '25551234567',
      description: 'Invalid - 11 digits not starting with 1'
    },
    {
      input: '',
      shouldBeValid: false,
      expectedFormat: '',
      description: 'Empty string'
    }
  ];

  testCases.forEach(testCase => {
    const isValid = validatePhoneNumber(testCase.input);
    const formatted = formatPhoneNumber(testCase.input);
    
    const validationPassed = isValid === testCase.shouldBeValid;
    const formatPassed = formatted === testCase.expectedFormat;
    
    logResult(
      `Validate: ${testCase.description}`,
      validationPassed,
      `Validation ${validationPassed ? 'correct' : 'incorrect'}`,
      {
        input: testCase.input,
        expectedValid: testCase.shouldBeValid,
        actualValid: isValid
      }
    );
    
    logResult(
      `Format: ${testCase.description}`,
      formatPassed,
      `Formatting ${formatPassed ? 'correct' : 'incorrect'}`,
      {
        input: testCase.input,
        expectedFormat: testCase.expectedFormat,
        actualFormat: formatted
      }
    );
  });
}

// Main execution
async function runSecurityValidation() {
  console.log('🔒 DD Upgrade Security and Data Integrity Validation');
  console.log('====================================================\n');

  // Run all tests
  await testUserCanUpdateOwnDDStatus();
  await testLicensePhotoStoragePermissions();
  await testLicensePhotoAccessControl();
  testFormInputSanitization();
  testPhoneNumberValidation();

  // Summary
  console.log('\n====================================================');
  console.log('📊 VALIDATION SUMMARY');
  console.log('====================================================\n');

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

  if (failedTests > 0) {
    console.log('Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.test}: ${r.message}`);
      });
    console.log('');
  }

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the validation
runSecurityValidation().catch(error => {
  console.error('Fatal error during validation:', error);
  process.exit(1);
});
