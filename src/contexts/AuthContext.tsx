
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, performEnhancedSignOut, refreshSession, isAuthError } from '@/utils/authUtils';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUserSession: () => Promise<{ success: boolean; error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle specific auth events
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, cleaning up...');
          // Defer cleanup to prevent deadlocks
          setTimeout(() => {
            cleanupAuthState();
          }, 0);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        } else if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user?.email);
        }

        setLoading(false);
      }
    );

    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (isAuthError(error)) {
            console.log('Auth error detected, cleaning up...');
            cleanupAuthState();
          }
        }
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Session check failed:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Signing in user:', email);
    
    try {
      // Clean up any existing state before signing in
      cleanupAuthState();
      
      // Attempt global sign out first (ignore errors)
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.warn('Pre-signin cleanup failed (continuing):', err);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      console.log('Sign in successful');
      
      // Force page reload for clean state
      setTimeout(() => {
        window.location.href = '/';
      }, 100);

      return { error: null };
    } catch (error) {
      console.error('Sign in failed:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    console.log('Signing up user:', email);
    
    try {
      // Clean up any existing state before signing up
      cleanupAuthState();

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error('Sign up error:', error);
      } else {
        console.log('Sign up successful');
      }

      return { error };
    } catch (error) {
      console.error('Sign up failed:', error);
      return { error };
    }
  };

  const signOut = async () => {
    console.log('Initiating sign out...');
    
    try {
      const result = await performEnhancedSignOut();
      
      if (result.success) {
        toast({
          title: "Signed out",
          description: "You have been signed out successfully",
        });
      } else {
        toast({
          title: "Sign out completed",
          description: "Signed out with cleanup (some errors occurred)",
          variant: "default",
        });
      }

      // Force page reload for clean state
      setTimeout(() => {
        window.location.href = '/auth';
      }, 100);
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign out error",
        description: "There was an issue signing out, but you've been logged out locally",
        variant: "destructive",
      });
      
      // Force reload anyway
      setTimeout(() => {
        window.location.href = '/auth';
      }, 100);
    }
  };

  const refreshUserSession = async () => {
    console.log('Manually refreshing user session...');
    
    const result = await refreshSession();
    
    if (result.success) {
      toast({
        title: "Session refreshed",
        description: "Your session has been refreshed successfully",
      });
    } else {
      toast({
        title: "Session refresh failed",
        description: "Please try logging in again",
        variant: "destructive",
      });
    }
    
    return result;
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUserSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
