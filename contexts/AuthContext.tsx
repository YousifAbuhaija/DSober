import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types/database.types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
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
    let isMounted = true;
    let lastUserId: string | null = null;

    // IMPORTANT: Do NOT call other supabase functions (await) directly inside
    // onAuthStateChange. The auth client dispatches events behind a lock and
    // awaiting another supabase call from the callback will deadlock the
    // client (queries hang forever). We defer all such work with setTimeout.
    // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    const loadProfileAndSubscribe = (userId: string) => {
      fetchUserProfile(userId).then((profile) => {
        if (!isMounted) return;
        setUser(profile);
      });

      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      realtimeChannel = supabase
        .channel('user-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            console.log('User profile updated in real-time:', payload);
            const oldRecord = payload.old as any;
            const newRecord = payload.new as any;

            const criticalFieldsChanged =
              oldRecord?.dd_status !== newRecord?.dd_status ||
              oldRecord?.role !== newRecord?.role ||
              oldRecord?.is_dd !== newRecord?.is_dd;

            if (criticalFieldsChanged) {
              console.log('Critical field changed, refreshing user profile');
              fetchUserProfile(userId).then((p) => {
                if (isMounted) setUser(p);
              });
            }
          }
        )
        .subscribe();
    };

    const teardownRealtime = () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };

    // Listen for auth changes. Supabase fires INITIAL_SESSION on subscribe,
    // so this single listener handles both startup and subsequent changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);

        const newUserId = session?.user?.id ?? null;
        if (newUserId) {
          // Only re-subscribe if the user actually changed to avoid
          // tearing down the realtime channel on every token refresh.
          if (newUserId !== lastUserId) {
            lastUserId = newUserId;
            // Defer supabase calls out of the auth lock to avoid a deadlock.
            setTimeout(() => {
              if (!isMounted) return;
              loadProfileAndSubscribe(newUserId);
            }, 0);
          }
        } else {
          lastUserId = null;
          setUser(null);
          teardownRealtime();
        }

        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      teardownRealtime();
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

  const signUp = async (email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // Profile will be created when user completes BasicInfo screen
    if (data.user) {
      setUser(null);
    }

    // If no session came back, Supabase requires email confirmation
    return { needsEmailConfirmation: !data.session };
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
