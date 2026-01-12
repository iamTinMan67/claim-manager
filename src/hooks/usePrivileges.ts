import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface UserPrivileges {
  hasExclusive: boolean;
  hasAdmin: boolean;
  adminTier: string | null;
  hasValidAccess: boolean;
  hasPremium: boolean;
  loading: boolean;
}

export const usePrivileges = () => {
  const [privileges, setPrivileges] = useState<UserPrivileges>({
    hasExclusive: false,
    hasAdmin: false,
    adminTier: null,
    hasValidAccess: false,
    hasPremium: false,
    loading: true,
  });
  const { user } = useAuth();

  const checkPrivileges = async () => {
    if (!user) {
      setPrivileges({
        hasExclusive: false,
        hasAdmin: false,
        adminTier: null,
        hasValidAccess: false,
        hasPremium: false,
        loading: false,
      });
      return;
    }

    try {
      setPrivileges(prev => ({ ...prev, loading: true }));

      // Check all privilege functions
      const [exclusiveResult, adminResult, adminTierResult, validAccessResult, premiumResult] = await Promise.all([
        supabase.rpc('has_exclusive_privileges', { user_id_param: user.id }),
        supabase.rpc('has_admin_tier', { user_id_param: user.id }),
        supabase.rpc('get_admin_tier', { user_id_param: user.id }),
        supabase.rpc('has_valid_access', { user_id_param: user.id }),
        supabase.rpc('has_premium_access', { user_id_param: user.id }),
      ]);

      // Check for errors in each RPC call and log them with full details
      if (exclusiveResult.error) {
        console.error('Error checking has_exclusive_privileges:', {
          error: exclusiveResult.error,
          code: exclusiveResult.error.code,
          message: exclusiveResult.error.message,
          details: exclusiveResult.error.details,
          hint: exclusiveResult.error.hint
        });
      }
      if (adminResult.error) {
        console.error('Error checking has_admin_tier:', {
          error: adminResult.error,
          code: adminResult.error.code,
          message: adminResult.error.message,
          details: adminResult.error.details,
          hint: adminResult.error.hint
        });
      }
      if (adminTierResult.error) {
        console.error('Error checking get_admin_tier:', {
          error: adminTierResult.error,
          code: adminTierResult.error.code,
          message: adminTierResult.error.message,
          details: adminTierResult.error.details,
          hint: adminTierResult.error.hint
        });
      }
      if (validAccessResult.error) {
        console.error('Error checking has_valid_access:', {
          error: validAccessResult.error,
          code: validAccessResult.error.code,
          message: validAccessResult.error.message,
          details: validAccessResult.error.details,
          hint: validAccessResult.error.hint
        });
      }
      if (premiumResult.error) {
        console.error('Error checking has_premium_access:', {
          error: premiumResult.error,
          code: premiumResult.error.code,
          message: premiumResult.error.message,
          details: premiumResult.error.details,
          hint: premiumResult.error.hint
        });
      }

      // Log the actual values being returned for debugging
      console.log('Privileges check results:', {
        hasExclusive: exclusiveResult.data,
        hasAdmin: adminResult.data,
        adminTier: adminTierResult.data,
        hasValidAccess: validAccessResult.data,
        hasPremium: premiumResult.data,
        errors: {
          exclusive: exclusiveResult.error ? {
            code: exclusiveResult.error.code,
            message: exclusiveResult.error.message
          } : null,
          admin: adminResult.error ? {
            code: adminResult.error.code,
            message: adminResult.error.message
          } : null,
          adminTier: adminTierResult.error ? {
            code: adminTierResult.error.code,
            message: adminTierResult.error.message
          } : null,
          validAccess: validAccessResult.error ? {
            code: validAccessResult.error.code,
            message: validAccessResult.error.message
          } : null,
          premium: premiumResult.error ? {
            code: premiumResult.error.code,
            message: premiumResult.error.message
          } : null,
        }
      });

      setPrivileges({
        hasExclusive: exclusiveResult.error ? false : (exclusiveResult.data || false),
        hasAdmin: adminResult.error ? false : (adminResult.data || false),
        adminTier: adminTierResult.error ? null : (adminTierResult.data || null),
        hasValidAccess: validAccessResult.error ? false : (validAccessResult.data || false),
        hasPremium: premiumResult.error ? false : (premiumResult.data || false),
        loading: false,
      });
    } catch (error) {
      console.error('Error checking privileges:', error);
      setPrivileges({
        hasExclusive: false,
        hasAdmin: false,
        adminTier: null,
        hasValidAccess: false,
        hasPremium: false,
        loading: false,
      });
    }
  };

  useEffect(() => {
    checkPrivileges();
  }, [user]);

  return {
    ...privileges,
    refreshPrivileges: checkPrivileges,
  };
};
