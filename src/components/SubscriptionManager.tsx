import React, { useState } from 'react'
import { DollarSign, HelpCircle, CreditCard, X } from 'lucide-react'
import { useNavigation } from '@/contexts/NavigationContext'
import { supabase } from '@/integrations/supabase/client'


const SubscriptionManager = () => {
  const { navigateTo } = useNavigation()
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  const handleClose = () => {
    console.log('X button clicked - closing welcome screen')
    // Mark welcome as seen and navigate to claims
    try {
      window.sessionStorage.setItem('welcome_seen_session', '1')
      window.dispatchEvent(new CustomEvent('welcomePrefsChanged'))
    } catch {}
    console.log('Navigating to claims')
    navigateTo('claims')
  }

  const handleDonationSelection = (donationType: string) => {
    if (donationType === 'free') {
      // Free tier - mark as subscribed in backend and go to claims
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return
        await supabase.from('subscribers').upsert({
          user_id: user.id,
          email: user.email,
          subscription_tier: 'free',
          subscribed: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        // Clear any previous local selection to avoid gating issues
        try {
          window.localStorage.removeItem('guest_pricing_selected')
          // Mark welcome dismissed for this session when selecting Free
          window.sessionStorage.setItem('welcome_seen_session', '1')
          window.dispatchEvent(new CustomEvent('welcomePrefsChanged'))
        } catch {}
        navigateTo('claims')
      })
    } else {
      // Donation tiers - show payment modal
      setSelectedPackage(donationType)
      setShowPaymentModal(true)
    }
  }

  const handlePaymentComplete = async () => {
    if (!selectedPackage || isProcessingPayment) return

    // Get donation details
    const donationDetails = {
      basic: { amount: 5, name: 'Basic Donation - 2–7 guests total' },
      frontend: { amount: 10, name: 'Premium - Buy All Files. (8+ guests)' }
    }

    const donationInfo = donationDetails[selectedPackage as keyof typeof donationDetails]
    if (!donationInfo) return

    // Show confirmation dialog before processing
    const confirmed = window.confirm(
      `Are you sure you want to make a ${donationInfo.name} for £${donationInfo.amount}?\n\n` +
      `This will support further application development and upgrade your collaboration access.`
    )

    if (!confirmed) {
      return
    }

    setIsProcessingPayment(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create Stripe checkout session using existing donation payment function
      const { data, error } = await supabase.functions.invoke('create-donation-payment', {
        body: {
          claimId: 'app-development-donation', // Use a placeholder claim ID
          shareId: 'temp-share', // Use a placeholder share ID
          customAmount: donationInfo.amount * 100, // Amount in pence
          packageType: selectedPackage,
          packageName: donationInfo.name
        }
      })

      if (error) {
        console.error('Stripe checkout error:', error)
        throw new Error(error.message || 'Failed to create checkout session')
      }

      // Mark welcome dismissed for this session when proceeding to Stripe
      try {
        window.sessionStorage.setItem('welcome_seen_session', '1')
        window.dispatchEvent(new CustomEvent('welcomePrefsChanged'))
      } catch {}
      // Redirect to Stripe checkout
      window.location.href = data.url

    } catch (error) {
      console.error('Payment failed:', error)
      alert('Failed to create payment session. Please try again.')
      setIsProcessingPayment(false)
    }
  }

  return (
    <>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="text-center mb-8 relative">
          <button
            onClick={handleClose}
            className="absolute top-0 right-0 p-2 text-gold hover:text-yellow-300 transition-colors"
            title="Close welcome screen"
          >
            <X className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-gold mb-4">Welcome to Claim Manager</h1>
          <p className="text-gold-light text-lg">
            Choose your collaboration package to start sharing claims with guests
          </p>
        </div>

        {/* Guest Access Pricing Section */}
        <div className="card-enhanced p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-gold" />
              <h3 className="text-lg font-semibold text-gold">Guest Access Pricing</h3>
            </div>
            <button
              onClick={() => window.open('#', '_blank')}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700/50 border border-yellow-400 text-yellow-400 rounded-lg hover:bg-slate-700/70 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>FAQ</span>
            </button>
          </div>
          <p className="text-gold-light text-sm mb-4">
            Support further application development and unlock collaboration features:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button 
              onClick={() => handleDonationSelection('free')}
              className="card-enhanced p-3 hover:bg-slate-700/50 transition-colors cursor-pointer border-2 border-green-400/30 hover:border-green-400/60 w-56"
            >
              <div className="font-medium text-gold">Free Tier</div>
              <div className="text-green-400 font-bold">FREE</div>
              <div className="text-xs text-gold-light mt-1">1 guest total</div>
            </button>
            <button 
              onClick={() => handleDonationSelection('basic')}
              className="card-enhanced p-3 hover:bg-slate-700/50 transition-colors cursor-pointer border-2 border-yellow-400/30 hover:border-yellow-400/60 w-56"
            >
              <div className="font-medium text-gold">Basic Donation</div>
              <div className="text-gold font-bold">£5</div>
              <div className="text-xs text-gold-light mt-1">2–7 guests total</div>
            </button>
            {/* Moderate tier removed per requirements */}
            <button 
              onClick={() => handleDonationSelection('frontend')}
              className="card-enhanced p-3 hover:bg-slate-700/50 transition-colors cursor-pointer border-2 border-yellow-400/30 hover:border-yellow-400/60 w-56"
            >
              <div className="font-medium text-gold">Premium - Buy All Files.</div>
              <div className="text-gold font-bold">£10</div>
              <div className="text-xs text-gold-light mt-1">8+ guests, all frontend files</div>
            </button>
          </div>
          <div className="mt-4 p-3 card-enhanced">
            <h4 className="font-medium text-gold mb-2">Account Requirements</h4>
            <p className="text-sm text-gold-light">
              <strong>All guests must have their own registered account</strong> on this app before they can be invited. 
              This allows them to create and manage their own claims and have full account functionality beyond just guest access.
            </p>
          </div>
          <p className="text-gold-light text-sm mt-3">
            <strong>Note:</strong> First guest is FREE! Donations unlock additional collaboration features. 
            £22 donation includes full rights to the app with complete source code and unlimited usage. 
            All donations support further application development. Each user can be both a claim owner (hosting their own claims) and a guest (invited to others' claims).
          </p>
        </div>

        {/* Do not show again preference + Donation Selection Note */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-3">
            <label className="flex items-center space-x-2 text-sm text-gold-light">
              <input
                type="checkbox"
                onChange={(e) => {
                  try {
                    if (e.target.checked) {
                      window.localStorage.setItem('welcome_never', '1')
                    } else {
                      window.localStorage.removeItem('welcome_never')
                    }
                    window.dispatchEvent(new CustomEvent('welcomePrefsChanged'))
                  } catch {}
                }}
                className="rounded"
              />
              <span>Do not show this welcome again</span>
            </label>
          </div>
          <p className="text-gold-light text-sm">
            Click on a donation tier above to support development and unlock collaboration features.
            You can always make additional donations later when you need more guests.
          </p>
        </div>
      </div>

      {/* Payment Modal - Rendered outside main container */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-[99999] flex items-center justify-center p-4">
          <div className="p-6 rounded-[16px] shadow max-w-md w-full"
            style={{ backgroundColor: 'rgba(30, 58, 138, 0.9)', border: '2px solid #fbbf24' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gold">Complete Your Donation</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="bg-white/10 border border-red-400 text-red-400 px-2 py-1 rounded hover:opacity-90"
              >
                ×
              </button>
            </div>
            
            <div className="text-center mb-6">
              <CreditCard className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h4 className="text-gold font-semibold mb-2">
                {selectedPackage === 'basic' && 'Basic Donation - £5 (2–7 guests total)'}
                {selectedPackage === 'frontend' && 'Premium - Buy All Files. - £10 (8+ guests, all frontend files)'}
              </h4>
              <p className="text-gold-light text-sm">
                One-time donation to support app development and unlock collaboration features
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handlePaymentComplete}
                disabled={isProcessingPayment}
                className="w-full px-4 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 font-semibold rounded-lg hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingPayment ? 'Processing Donation...' : 'Donate with Stripe'}
              </button>
              <button
                onClick={async () => {
                  // Fallback: mark as subscribed without Stripe (for manual/test scenarios)
                  const { data: { user } } = await supabase.auth.getUser()
                  if (!user || !selectedPackage) return
                  await supabase.from('subscribers').upsert({
                    user_id: user.id,
                    email: user.email,
                    subscription_tier: selectedPackage,
                    subscribed: true,
                    updated_at: new Date().toISOString()
                  }, { onConflict: 'user_id' })
                  try { window.localStorage.removeItem('guest_pricing_selected') } catch {}
                  setShowPaymentModal(false)
                  navigateTo('claims')
                }}
                className="w-full px-4 py-3 bg-slate-700/50 border border-yellow-400 text-yellow-400 rounded-lg hover:bg-slate-700/70 transition-colors"
              >
                I’ve already donated (continue)
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-yellow-400 text-yellow-400 rounded-lg hover:bg-slate-700/70 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SubscriptionManager