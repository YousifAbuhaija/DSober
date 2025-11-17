import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types/database.types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from database
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If user doesn't exist yet, return null (not an error during signup)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      // Map snake_case database columns to camelCase TypeScript interface
      if (data) {
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          birthday: new Date(data.birthday),
          age: data.age,
          gender: data.gender,
          groupId: data.group_id,
          role: data.role,
          isDD: data.is_dd,
          ddStatus: data.dd_status || 'none',
          carMake: data.car_make,
          carModel: data.car_model,
          carPlate: data.car_plate,
          phoneNumber: data.phone_number,
          licensePhotoUrl: data.license_photo_url,
          profilePhotoUrl: data.profile_photo_url,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        } as User;
      }

      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Initialize session
  useEffect(() => {
    let realtimeChannel: any = null;
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id).then(setUser);
        
        // Set up real-time subscription to user's profile changes
        // Only listen for specific critical fields to avoid triggering on every onboarding step
        realtimeChannel = supabase
          .channel('user-profile-changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'users',
              filter: `id=eq.${session.user.id}`,
            },
            (payload) => {
              console.log('User profile updated in real-time:', payload);
              // Only refresh if critical fields changed (dd_status, role, is_dd)
              // This prevents constant refreshes during onboarding flow
              const oldRecord = payload.old as any;
              const newRecord = payload.new as any;
              
              const criticalFieldsChanged = 
                oldRecord?.dd_status !== newRecord?.dd_status ||
                oldRecord?.role !== newRecord?.role ||
                oldRecord?.is_dd !== newRecord?.is_dd;
              
              if (criticalFieldsChanged) {
                console.log('Critical field changed, refreshing user profile');
                fetchUserProfile(session.user.id).then(setUser);
              }
            }
          )
          .subscribe();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
          
          // Set up real-time subscription for new session
          if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
          }
          
          realtimeChannel = supabase
            .channel('user-profile-changes')
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${session.user.id}`,
              },
              (payload) => {
                console.log('User profile updated in real-time:', payload);
                // Only refresh if critical fields changed
                const oldRecord = payload.old as any;
                const newRecord = payload.new as any;
                
                const criticalFieldsChanged = 
                  oldRecord?.dd_status !== newRecord?.dd_status ||
                  oldRecord?.role !== newRecord?.role ||
                  oldRecord?.is_dd !== newRecord?.is_dd;
                
                if (criticalFieldsChanged) {
                  console.log('Critical field changed, refreshing user profile');
                  fetchUserProfile(session.user.id).then(setUser);
                }
              }
            )
            .subscribe();
        } else {
          setUser(null);
          if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
          }
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const profile = await fetchUserProfile(data.user.id);
      setUser(profile);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // Profile will be created when user completes BasicInfo screen
    // Set user to null initially - they'll go through onboarding
    if (data.user) {
      setUser(null);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  const refreshUser = async () => {
    if (session?.user) {
      console.log('Refreshing user profile...');
      const profile = await fetchUserProfile(session.user.id);
      console.log('User profile refreshed:', { 
        id: profile?.id, 
        name: profile?.name, 
        ddStatus: profile?.ddStatus 
      });
      setUser(profile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
