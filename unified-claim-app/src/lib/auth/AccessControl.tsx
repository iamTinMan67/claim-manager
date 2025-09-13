import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Lock, Crown, AlertTriangle, CreditCard } from 'lucide-react'

interface AccessControlProps {
  children: React.ReactNode
  requiredFeature?: string
  requiredTier?: string
  claimId?: string
  fallback?: React.ReactNode
  showUpgradePrompt?: boolean
}

interface UserSubscription {
  id: string
  status: string
  current_period_end: string
  subscription_tiers: {
    tier_name: string
    display_name: string
    features: Record<string, boolean>
    max_claims: number
    max_guests_per_claim: number
    max_evidence_per_claim: number
  }
}

const AccessControl = ({ 
  children, 
  requiredFeature, 
  requiredTier, 
  claimId, 
  fallback,
  showUpgradePrompt = true 
}: AccessControlProps) => {
  // Get current user subscription
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['user-subscription-access'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_tiers(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        // No active subscription, return free tier
        const { data: freeTier } = await supabase
          .from('subscription_tiers')
          .select('*')
          .eq('tier_name', 'free')
          .single()
        
        return {
          subscription_tiers: freeTier
        }
      }
      
      return data as UserSubscription
    }
  })

  // Check if user has paid access to specific claim (for guests)
  const { data: claimAccess } = useQuery({
    queryKey: ['claim-access', claimId],
    queryFn: async () => {
      if (!claimId) return true
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      // Check if user owns the claim
      const { data: ownedClaim } = await supabase
        .from('claims')
        .select('id')
        .eq('case_number', claimId)
        .eq('user_id', user.id)
        .single()
      
      if (ownedClaim) return true

      // Check if user has paid guest access
      const { data: guestAccess } = await supabase
        .from('claim_shares')
        .select('payment_verified, access_expires_at')
        .eq('claim_id', claimId)
        .eq('shared_with_id', user.id)
        .eq('payment_verified', true)
        .single()
      
      if (!guestAccess) return false
      
      // Check if access hasn't expired
      if (guestAccess.access_expires_at && new Date(guestAccess.access_expires_at) < new Date()) {
        return false
      }
      
      return true
    },
    enabled: !!claimId
  })

  // Get usage stats for limit checking
  const { data: usageStats } = useQuery({
    queryKey: ['usage-stats-access'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const [claimsResult, guestsResult, evidenceResult] = await Promise.all([
        supabase.from('claims').select('case_number', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('claim_shares').select('id', { count: 'exact' }).eq('owner_id', user.id),
        supabase.from('evidence').select('id', { count: 'exact' }).eq('user_id', user.id)
      ])

      return {
        claims: claimsResult.count || 0,
        guests: guestsResult.count || 0,
        evidence: evidenceResult.count || 0
      }
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Check claim access first
  if (claimId && claimAccess === false) {
    return fallback || (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h3>
        <p className="text-red-700 mb-4">
          You don't have access to this claim. Payment verification is required for guest access.
        </p>
        {showUpgradePrompt && (
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
            Contact Claim Owner
          </button>
        )}
      </div>
    )
  }

  // Check subscription status
  if (subscription?.status === 'past_due' || subscription?.status === 'unpaid') {
    return fallback || (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">Payment Required</h3>
        <p className="text-yellow-700 mb-4">
          Your subscription payment is overdue. Please update your payment method to continue using premium features.
        </p>
        {showUpgradePrompt && (
          <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
            Update Payment Method
          </button>
        )}
      </div>
    )
  }

  const currentTier = subscription?.subscription_tiers
  if (!currentTier) {
    return fallback || (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription Required</h3>
        <p className="text-gray-700 mb-4">
          Please subscribe to access this feature.
        </p>
      </div>
    )
  }

  // Check feature access
  if (requiredFeature && !currentTier.features[requiredFeature]) {
    return fallback || (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <Crown className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Premium Feature</h3>
        <p className="text-blue-700 mb-4">
          This feature requires a higher subscription tier. Upgrade your plan to access {requiredFeature.replace('_', ' ')}.
        </p>
        {showUpgradePrompt && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Upgrade Plan
          </button>
        )}
      </div>
    )
  }

  // Check tier requirement
  const tierHierarchy = ['free', 'basic', 'professional', 'enterprise']
  if (requiredTier) {
    const currentTierIndex = tierHierarchy.indexOf(currentTier.tier_name)
    const requiredTierIndex = tierHierarchy.indexOf(requiredTier)
    
    if (currentTierIndex < requiredTierIndex) {
      return fallback || (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
          <Crown className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-purple-900 mb-2">Upgrade Required</h3>
          <p className="text-purple-700 mb-4">
            This feature requires the {requiredTier} plan or higher. You're currently on the {currentTier.display_name} plan.
          </p>
          {showUpgradePrompt && (
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
              Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
            </button>
          )}
        </div>
      )
    }
  }

  // Check usage limits
  if (usageStats) {
    // Check claims limit
    if (currentTier.max_claims !== -1 && usageStats.claims >= currentTier.max_claims) {
      return fallback || (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-orange-900 mb-2">Limit Reached</h3>
          <p className="text-orange-700 mb-4">
            You've reached your claims limit ({currentTier.max_claims}). Upgrade your plan or remove some claims to continue.
          </p>
          {showUpgradePrompt && (
            <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
              Upgrade Plan
            </button>
          )}
        </div>
      )
    }
  }

  // All checks passed, render children
  return <>{children}</>
}

export default AccessControl