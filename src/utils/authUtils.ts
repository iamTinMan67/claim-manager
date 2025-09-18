
import { supabase } from '@/integrations/supabase/client';

/**
 * Comprehensive cleanup of all authentication-related storage
 */
export const cleanupAuthState = () => {
  console.log('Cleaning up authentication state...');
  
  // Remove standard auth tokens from localStorage
  const keysToRemove = [
    'supabase.auth.token',
    'sb-access-token',
    'sb-refresh-token'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      console.log(`Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  if (typeof sessionStorage !== 'undefined') {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        console.log(`Removing sessionStorage key: ${key}`);
        sessionStorage.removeItem(key);
      }
    });
  }
};

/**
 * Enhanced sign out with comprehensive cleanup
 */
export const performEnhancedSignOut = async () => {
  console.log('Performing enhanced sign out...');
  
  try {
    // Step 1: Clean up auth state first
    cleanupAuthState();
    
    // Step 2: Attempt global sign out (don't throw on errors)
    try {
      await supabase.auth.signOut({ scope: 'global' });
      console.log('Supabase sign out successful');
    } catch (signOutError) {
      console.warn('Supabase sign out failed (continuing anyway):', signOutError);
    }
    
    // Step 3: Clean up again to ensure everything is removed
    cleanupAuthState();
    
    console.log('Enhanced sign out completed');
    return { success: true };
  } catch (error) {
    console.error('Enhanced sign out error:', error);
    // Even if there's an error, clean up what we can
    cleanupAuthState();
    return { success: false, error };
  }
};

/**
 * Manual session refresh with error handling
 */
export const refreshSession = async () => {
  console.log('Attempting to refresh session...');
  
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Session refresh failed:', error);
      return { success: false, error };
    }
    
    console.log('Session refreshed successfully');
    return { success: true, session: data.session };
  } catch (error) {
    console.error('Session refresh error:', error);
    return { success: false, error };
  }
};

/**
 * Check if error is authentication-related
 */
export const isAuthError = (error: any): boolean => {
  if (!error) return false;
  
  const authErrorCodes = [
    'invalid_grant',
    'invalid_token',
    'token_expired',
    'refresh_token_not_found',
    'session_not_found',
    'user_not_found'
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  return authErrorCodes.some(code => 
    errorMessage.includes(code) || errorCode.includes(code)
  ) || errorMessage.includes('jwt') || errorMessage.includes('unauthorized');
};

/**
 * Retry operation with reauthentication
 */
export const retryWithReauth = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (isAuthError(error) && maxRetries > 0) {
      console.log('Auth error detected, attempting session refresh...');
      
      const refreshResult = await refreshSession();
      if (refreshResult.success) {
        console.log('Session refreshed, retrying operation...');
        return retryWithReauth(operation, maxRetries - 1);
      } else {
        console.log('Session refresh failed, throwing original error');
        throw error;
      }
    }
    throw error;
  }
};
