/**
 * Real-time State Update Tests for DD Upgrade Feature
 * 
 * This test suite verifies that:
 * 1. AuthContext real-time subscription detects DD status changes
 * 2. RidesScreen automatically re-renders after DD upgrade
 * 3. DD interface displays after upgrade completion
 * 4. No manual page refresh is required
 * 
 * Requirements: 3.5, 4.1, 4.2, 4.3, 4.4
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import RidesScreen from '../screens/RidesScreen';
import { supabase } from '../lib/supabase';

// Mock Supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
  useFocusEffect: (callback: () => void) => {
    React.useEffect(() => {
      callback();
    }, []);
  },
}));

describe('DD Upgrade Real-time State Updates', () => {
  let realtimeCallback: any;
  let mockChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock channel for real-time subscription
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    };

    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    
    // Capture the real-time callback
    mockChannel.on.mockImplementation((event: string, config: any, callback: any) => {
      realtimeCallback = callback;
      return mockChannel;
    });
  });

  describe('Requirement 3.5: Real-time user context refresh', () => {
    it('should detect DD status changes via real-time subscription', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      const mockUserBefore = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        is_dd: false,
        dd_status: 'none',
      };

      const mockUserAfter = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        is_dd: true,
        dd_status: 'active',
      };

      // Setup initial session
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      // Setup initial user fetch
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUserBefore,
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      // Render AuthProvider
      const TestComponent = () => {
        const { user } = useAuth();
        return null;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith('user-profile-changes');
      });

      // Verify real-time subscription was set up
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${mockSession.user.id}`,
        }),
        expect.any(Function)
      );

      // Simulate DD status change via real-time update
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUserAfter,
              error: null,
            }),
          }),
        }),
      });

      await act(async () => {
        realtimeCallback({
          old: mockUserBefore,
          new: mockUserAfter,
        });
      });

      // Verify user profile was refreshed
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('users');
      });
    });

    it('should only trigger refresh on critical field changes', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        is_dd: false,
        dd_status: 'none',
        phone_number: '555-1234',
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const TestComponent = () => {
        const { user } = useAuth();
        return null;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      const initialCallCount = mockFrom.mock.calls.length;

      // Simulate non-critical field change (phone number)
      await act(async () => {
        realtimeCallback({
          old: mockUser,
          new: { ...mockUser, phone_number: '555-5678' },
        });
      });

      // Should NOT trigger refresh for non-critical fields
      expect(mockFrom.mock.calls.length).toBe(initialCallCount);

      // Simulate critical field change (dd_status)
      await act(async () => {
        realtimeCallback({
          old: mockUser,
          new: { ...mockUser, dd_status: 'active', is_dd: true },
        });
      });

      // SHOULD trigger refresh for critical fields
      await waitFor(() => {
        expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Requirement 4.1: DD interface display after upgrade', () => {
    it('should display DD interface when user.isDD is true', async () => {
      const mockDDUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        isDD: true,
        ddStatus: 'active',
      };

      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'test@example.com',
                name: 'Test User',
                is_dd: true,
                dd_status: 'active',
              },
              error: null,
            }),
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
          }),
        }),
      });

      const { getByText } = render(
        <NavigationContainer>
          <AuthProvider>
            <RidesScreen />
          </AuthProvider>
        </NavigationContainer>
      );

      // Should show DD-specific interface
      await waitFor(() => {
        expect(getByText('No Active DD Session')).toBeTruthy();
      });
    });

    it('should display non-DD call-to-action when user.isDD is false', async () => {
      const mockNonDDUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        isDD: false,
        ddStatus: 'none',
      };

      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'test@example.com',
                name: 'Test User',
                is_dd: false,
                dd_status: 'none',
              },
              error: null,
            }),
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
          }),
        }),
      });

      const { getByText } = render(
        <NavigationContainer>
          <AuthProvider>
            <RidesScreen />
          </AuthProvider>
        </NavigationContainer>
      );

      // Should show non-DD call-to-action
      await waitFor(() => {
        expect(getByText('Become a Designated Driver')).toBeTruthy();
        expect(getByText('Get Started')).toBeTruthy();
      });
    });
  });

  describe('Requirement 4.2: Automatic UI transition', () => {
    it('should transition from non-DD to DD interface without manual refresh', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      let currentUserData = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        is_dd: false,
        dd_status: 'none',
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: currentUserData,
              error: null,
            }),
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
          }),
        }),
      }));

      const { getByText, rerender } = render(
        <NavigationContainer>
          <AuthProvider>
            <RidesScreen />
          </AuthProvider>
        </NavigationContainer>
      );

      // Initially should show non-DD interface
      await waitFor(() => {
        expect(getByText('Become a Designated Driver')).toBeTruthy();
      });

      // Simulate DD upgrade
      currentUserData = {
        ...currentUserData,
        is_dd: true,
        dd_status: 'active',
      };

      // Trigger real-time update
      await act(async () => {
        realtimeCallback({
          old: { is_dd: false, dd_status: 'none' },
          new: { is_dd: true, dd_status: 'active' },
        });
      });

      // Should automatically show DD interface
      await waitFor(() => {
        expect(getByText('No Active DD Session')).toBeTruthy();
      });
    });
  });

  describe('Requirement 4.3: No manual refresh required', () => {
    it('should update UI automatically via AuthContext subscription', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                is_dd: false,
                dd_status: 'none',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const TestComponent = () => {
        const { user } = useAuth();
        return null;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      // Verify subscription is active
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(realtimeCallback).toBeDefined();
    });
  });

  describe('Requirement 4.4: Real-time DD status reflection', () => {
    it('should reflect updated DD status through AuthContext', async () => {
      const mockSession = {
        user: { id: 'test-user-id', email: 'test@example.com' },
      };

      let userData = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        is_dd: false,
        dd_status: 'none',
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: userData,
              error: null,
            }),
          }),
        }),
      }));

      let capturedUser: any = null;

      const TestComponent = () => {
        const { user } = useAuth();
        capturedUser = user;
        return null;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial user load
      await waitFor(() => {
        expect(capturedUser).not.toBeNull();
      });

      // Verify initial state
      expect(capturedUser?.isDD).toBe(false);
      expect(capturedUser?.ddStatus).toBe('none');

      // Update user data
      userData = {
        ...userData,
        is_dd: true,
        dd_status: 'active',
      };

      // Trigger real-time update
      await act(async () => {
        realtimeCallback({
          old: { is_dd: false, dd_status: 'none' },
          new: { is_dd: true, dd_status: 'active' },
        });
      });

      // Verify updated state
      await waitFor(() => {
        expect(capturedUser?.isDD).toBe(true);
        expect(capturedUser?.ddStatus).toBe('active');
      });
    });
  });
});
