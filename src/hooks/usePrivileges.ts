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

      setPrivileges({
        hasExclusive: exclusiveResult.data || false,
        hasAdmin: adminResult.data || false,
        adminTier: adminTierResult.data || null,
        hasValidAccess: validAccessResult.data || false,
        hasPremium: premiumResult.data || false,
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
