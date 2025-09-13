import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Crown, Check, X, CreditCard, Users, FileText, Video, Palette, Download, Zap, DollarSign } from 'lucide-react'
import PaymentModal from './PaymentModal'

interface SubscriptionTier {
  id: string
  tier_name: string
  display_name: string
  description: string
  price_monthly: number
  price_yearly: number
  max_claims: number
  max_guests_per_claim: number
  max_evidence_per_claim: number
  features: {
    chat?: boolean
    video?: boolean
    whiteboard?: boolean
    export?: boolean
    priority_support?: boolean
    custom_branding?: boolean
  }
  is_active: boolean
}

interface UserSubscription {
  id: string
  tier_id: string
  status: string
  current_period_end: string
  cancel_at_period_end: boolean
  subscription_tiers: SubscriptionTier
}

const SubscriptionManager = () => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const queryClient = useQueryClient()

  // Get available subscription tiers
  const { data: tiers, isLoading: tiersLoading, error: tiersError } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })
      
      if (error) {
        // Return empty array if table doesn't exist
        if (error.code === '42P01') {
          return []
        }
        throw error
      }
      
      return data as SubscriptionTier[]
    }
  })

  // Get current user subscription
  const { data: currentSubscription } = useQuery({
    queryKey: ['current-subscription'],
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
      
      if (error && error.code !== 'PGRST116') throw error
      return data as UserSubscription
    }
  })

  // Get user's usage stats
  const { data: usageStats } = useQuery({
    queryKey: ['usage-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const [claimsResult, guestsResult, evidenceResult] = await Promise.all([
        supabase.from('claims').select('id', { count: 'exact' }).eq('user_id', user.id),
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

  const handleUpgrade = (tier: SubscriptionTier) => {
    setSelectedTier(tier)
    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = (paymentIntentId: string) => {
    queryClient.invalidateQueries({ queryKey: ['current-subscription'] })
    queryClient.invalidateQueries({ queryKey: ['usage-stats'] })
    setShowPaymentModal(false)
    setSelectedTier(null)
  }

  const handlePaymentError = (error: string) => {
    // Handle payment error silently
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(price / 100)
  }

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'chat': return <Users className="w-4 h-4" />
      case 'video': return <Video className="w-4 h-4" />
      case 'whiteboard': return <Palette className="w-4 h-4" />
      case 'export': return <Download className="w-4 h-4" />
      case 'priority_support': return <Zap className="w-4 h-4" />
      case 'custom_branding': return <Crown className="w-4 h-4" />
      default: return <Check className="w-4 h-4" />
    }
  }

  const isCurrentTier = (tier: SubscriptionTier) => {
    return currentSubscription?.subscription_tiers?.id === tier.id
  }

  const canUpgrade = (tier: SubscriptionTier) => {
    if (!currentSubscription) return tier.tier_name !== 'free'
    return currentSubscription.subscription_tiers.price_monthly < tier.price_monthly
  }

  if (tiersLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-center p-8">Loading subscription plans...</div>
        
        {/* Show Guest Access Pricing even while loading */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-900">Guest Access Pricing</h3>
          </div>
          <p className="text-blue-800 text-sm mb-4">
            When sharing claims with additional guests beyond your first free guest, the following pricing applies:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white p-3 rounded border">
              <div className="font-medium text-gray-900">First Guest</div>
              <div className="text-green-600 font-bold">FREE</div>
            </div>
            <div className="bg-white p-3 rounded border">
              <div className="font-medium text-gray-900">2nd Guest</div>
              <div className="text-blue-600 font-bold">£7</div>
            </div>
            <div className="bg-white p-3 rounded border">
              <div className="font-medium text-gray-900">3-5 Guests</div>
              <div className="text-blue-600 font-bold">£10</div>
            </div>
            <div className="bg-white p-3 rounded border">
              <div className="font-medium text-gray-900">6+ Guests</div>
              <div className="text-blue-600 font-bold">£20-£50</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-white rounded border">
            <h4 className="font-medium text-gray-900 mb-2">Account Requirements</h4>
            <p className="text-sm text-gray-700">
              <strong>All guests must have their own registered account</strong> on this app before they can be invited. 
              This allows them to create and manage their own claims and have full account functionality beyond just guest access.
            </p>
          </div>
          <p className="text-blue-800 text-sm mt-3">
            <strong>Note:</strong> First guest is FREE! Payment required for additional guests. All payments support app development. 
            Each user can be both a claim owner (hosting their own claims) and a guest (invited to others' claims).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
        <p className="text-lg text-gray-600 mb-8">
          Unlock powerful features for your legal practice
        </p>
        
        {/* Show error message if subscription tiers failed to load */}
        {tiersError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> Subscription plans are not available at the moment. 
              You can still use the guest access pricing below to add collaborators to your claims.
            </p>
          </div>
        )}
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              billingCycle === 'yearly' ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${billingCycle === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Yearly
            <span className="ml-1 text-green-600 font-medium">(Save 17%)</span>
          </span>
        </div>
      </div>

      {/* Current Usage Stats */}
      {usageStats && currentSubscription && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Current Usage</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{usageStats.claims}</div>
              <div className="text-sm text-blue-800">
                Claims ({currentSubscription.subscription_tiers.max_claims === -1 ? 'Unlimited' : `${currentSubscription.subscription_tiers.max_claims} max`})
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{usageStats.guests}</div>
              <div className="text-sm text-blue-800">Total Guests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{usageStats.evidence}</div>
              <div className="text-sm text-blue-800">
                Evidence ({currentSubscription.subscription_tiers.max_evidence_per_claim === -1 ? 'Unlimited' : `${currentSubscription.subscription_tiers.max_evidence_per_claim} max per claim`})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Tiers */}
      {tiers && tiers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => {
          const price = billingCycle === 'yearly' ? tier.price_yearly : tier.price_monthly
          const isPopular = tier.tier_name === 'professional'
          const isCurrent = isCurrentTier(tier)
          
          return (
            <div
              key={tier.id}
              className={`relative rounded-lg border-2 p-6 ${
                isPopular
                  ? 'border-blue-500 shadow-lg'
                  : isCurrent
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{tier.display_name}</h3>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {tier.price_monthly === 0 ? 'Free' : formatPrice(price)}
                </div>
                {tier.price_monthly > 0 && (
                  <div className="text-sm text-gray-500">
                    per {billingCycle === 'yearly' ? 'year' : 'month'}
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-2">{tier.description}</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <FileText className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{tier.max_claims === -1 ? 'Unlimited' : tier.max_claims} Claims</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Users className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{tier.max_guests_per_claim === -1 ? 'Unlimited' : tier.max_guests_per_claim} Guests per Claim</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <FileText className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{tier.max_evidence_per_claim === -1 ? 'Unlimited' : tier.max_evidence_per_claim} Evidence per Claim</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="space-y-2">
                    {Object.entries(tier.features).map(([feature, enabled]) => (
                      <div key={feature} className="flex items-center text-sm">
                        {enabled ? (
                          <Check className="w-4 h-4 mr-2 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 mr-2 text-gray-300" />
                        )}
                        <span className={enabled ? 'text-gray-900' : 'text-gray-400'}>
                          {feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleUpgrade(tier)}
                disabled={isCurrent || !canUpgrade(tier)}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  isCurrent
                    ? 'bg-green-100 text-green-800 cursor-default'
                    : canUpgrade(tier)
                      ? isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isCurrent ? 'Current Plan' : canUpgrade(tier) ? 'Upgrade' : 'Downgrade'}
              </button>
            </div>
          )
        })}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription Plans Coming Soon</h3>
          <p className="text-gray-600 mb-4">
            We're working on subscription plans. For now, you can use the guest access pricing below to add collaborators to your claims.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">
            <Crown className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Free to use with guest access pricing</span>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedTier && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          amount={billingCycle === 'yearly' ? selectedTier.price_yearly / 100 : selectedTier.price_monthly / 100}
          currency="gbp"
          paymentType="subscription"
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
      )}

      {/* Guest Access Pricing Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">Guest Access Pricing</h3>
        </div>
        <p className="text-blue-800 text-sm mb-4">
          When sharing claims with additional guests beyond your first free guest, the following pricing applies:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">First Guest</div>
            <div className="text-green-600 font-bold">FREE</div>
          </div>
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">2nd Guest</div>
            <div className="text-blue-600 font-bold">£7</div>
          </div>
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">3-5 Guests</div>
            <div className="text-blue-600 font-bold">£10</div>
          </div>
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">6+ Guests</div>
            <div className="text-blue-600 font-bold">£20-£50</div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white rounded border">
          <h4 className="font-medium text-gray-900 mb-2">Account Requirements</h4>
          <p className="text-sm text-gray-700">
            <strong>All guests must have their own registered account</strong> on this app before they can be invited. 
            This allows them to create and manage their own claims and have full account functionality beyond just guest access.
          </p>
        </div>
        <p className="text-blue-800 text-sm mt-3">
          <strong>Note:</strong> First guest is FREE! Payment required for additional guests. All payments support app development. 
          Each user can be both a claim owner (hosting their own claims) and a guest (invited to others' claims).
        </p>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">Can I change my plan anytime?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">What happens to my data if I downgrade?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Your data is never deleted. If you exceed limits, you'll need to upgrade or remove content to continue adding new items.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Do guest payments count towards my subscription?</h4>
            <p className="text-sm text-gray-600 mt-1">
              No, guest access payments are separate from your subscription and go directly to supporting the app.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">How does guest pricing work?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Your first guest is always free. Additional guests require a one-time payment that supports app development. 
              All guests must have registered accounts before being invited.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManager