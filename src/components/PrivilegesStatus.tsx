import React, { useEffect, useState, useCallback } from 'react';
import { usePrivileges } from '@/hooks/usePrivileges';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const PrivilegesStatus: React.FC = () => {
  const { 
    hasPremium, 
    loading,
    refreshPrivileges 
  } = usePrivileges();
  const { user } = useAuth();
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(true);

  // Fetch subscription tier
  const fetchTier = useCallback(async () => {
    if (!user) {
      setTierLoading(false);
      return;
    }

    try {
      setTierLoading(true);
      // First check user_privileges for premium_tier
      const { data: privilegeData } = await supabase
        .from('user_privileges')
        .select('premium_tier')
        .eq('user_id', user.id)
        .eq('privilege_type', 'premium')
        .eq('is_active', true)
        .maybeSingle();

      if (privilegeData?.premium_tier) {
        setSubscriptionTier(privilegeData.premium_tier);
        setTierLoading(false);
        return;
      }

      // Fallback to subscribers table
      const { data: subscriberData } = await supabase
        .from('subscribers')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      setSubscriptionTier(subscriberData?.subscription_tier || 'free');
    } catch (error) {
      console.error('Error fetching subscription tier:', error);
      setSubscriptionTier('free');
    } finally {
      setTierLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier, hasPremium]);

  const handleRefresh = () => {
    refreshPrivileges();
    fetchTier();
  };

  if (loading || tierLoading) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700 mr-2"></div>
          Checking privileges...
        </div>
      </div>
    );
  }

  const getTierColor = (tier: string | null) => {
    switch (tier) {
      case 'premium': return 'text-green-600 bg-green-100';
      case 'basic': return 'text-yellow-600 bg-yellow-100';
      case 'free': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTierDisplayName = (tier: string | null) => {
    if (!tier) return 'Free';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Your Privileges Status</h3>
        <button
          onClick={handleRefresh}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {/* Subscription Tier */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Star className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-medium">Subscription Tier</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTierColor(subscriptionTier)}`}>
            {getTierDisplayName(subscriptionTier)}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          {hasPremium ? (
            <span className="text-green-600 font-medium">
              ✅ You have {getTierDisplayName(subscriptionTier)} tier access.
            </span>
          ) : (
            <span className="text-gray-600 font-medium">
              You are on the {getTierDisplayName(subscriptionTier)} tier.
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default PrivilegesStatus;
