import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Users, Mail, Eye, Edit, Trash2, Plus, DollarSign, CreditCard, CheckCircle, Clock, AlertCircle, X } from 'lucide-react'

interface ClaimShare {
  id: string
  claim_id: string
  owner_id: string
  shared_with_id: string
  permission: 'view' | 'edit'
  can_view_evidence: boolean
  is_frozen: boolean
  is_muted: boolean
  donation_required: boolean
  donation_paid: boolean
  donation_amount?: number
  donation_paid_at?: string
  stripe_payment_intent_id?: string
  created_at: string
  claims: {
    title: string
    case_number: string
  }
  profiles: {
    email: string
    full_name?: string
  }
}

interface SharedClaimsProps {
  selectedClaim: string | null
  claimColor?: string
}

const SharedClaims = ({ selectedClaim, claimColor = '#3B82F6' }: SharedClaimsProps) => {
  const [showShareForm, setShowShareForm] = useState(false)
  const [claimToShare, setClaimToShare] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<{
    claimId: string
    guestEmail: string
    amount: number
    guestCount: number
  } | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [shareData, setShareData] = useState({
    email: '',
    permission: 'view' as const,
    can_view_evidence: false,
    is_frozen: false,
    is_muted: false
  })

  const queryClient = useQueryClient()

  // Calculate pricing based on guest count
  const calculateDonationAmount = (guestCount: number): number => {
    if (guestCount === 1) return 0 // First guest is FREE
    if (guestCount === 2) return 7 // £7 for second guest
    if (guestCount <= 5) return 10 // £10 for up to 5 guests
    if (guestCount <= 10) return 20 // £20 for 6-10 guests
    if (guestCount <= 20) return 20 // £20 for 11-20 guests
    if (guestCount <= 30) return 30 // £30 for 21-30 guests
    if (guestCount <= 40) return 40 // £40 for 31-40 guests
    if (guestCount <= 50) return 50 // £50 for 41-50 guests
    return 50 // Cap at £50
  }

  const { data: sharedClaims, isLoading } = useQuery({
    queryKey: ['shared-claims', selectedClaim],
    queryFn: async () => {
      let query = supabase
        .from('claim_shares')
        .select(`
          *,
          claims!inner(title, case_number),
          profiles!shared_with_id(email, full_name)
        `)
      
      if (selectedClaim) {
        query = query.eq('claim_id', selectedClaim)
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as ClaimShare[]
    }
  })

  // Query for guest count per claim to calculate pricing
  const { data: guestCounts } = useQuery({
    queryKey: ['guest-counts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return {}

      const { data, error } = await supabase
        .from('claim_shares')
        .select('claim_id')
        .eq('owner_id', user.id)
      
      if (error) throw error
      
      // Count guests per claim
      const counts: { [key: string]: number } = {}
      data.forEach(share => {
        counts[share.claim_id] = (counts[share.claim_id] || 0) + 1
      })
      
      return counts
    }
  })

  const { data: myClaims } = useQuery({
    queryKey: ['my-claims-for-sharing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title')
        .order('title')
      
      if (error) throw error
      return data
    }
  })

  const shareClaimMutation = useMutation({
    mutationFn: async (shareInfo: typeof shareData & { claim_id: string, donation_amount: number }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // First, check if user exists or create a profile
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', shareInfo.email)
        .single()

      if (!existingUser) {
        throw new Error('User with this email does not exist. They need to create an account first.')
      }

      const { data, error } = await supabase
        .from('claim_shares')
        .insert([{
          claim_id: shareInfo.claim_id,
          owner_id: user.id,
          shared_with_id: existingUser.id,
          permission: shareInfo.permission,
          can_view_evidence: shareInfo.can_view_evidence,
          is_frozen: false,
          is_muted: false,
          donation_required: shareInfo.donation_amount > 0, // Only required if amount > 0
          donation_paid: shareInfo.donation_amount === 0, // Free guests are automatically "paid"
          donation_amount: shareInfo.donation_amount
        }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      queryClient.invalidateQueries({ queryKey: ['guest-counts'] })
      setShowShareForm(false)
      setShareData({
        email: '',
        permission: 'view',
        can_view_evidence: false,
        is_frozen: false,
        is_muted: false
      })
      setClaimToShare('')
    }
  })

  const deleteShareMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('claim_shares')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      queryClient.invalidateQueries({ queryKey: ['guest-counts'] })
    }
  })

  const toggleFreezeGuestMutation = useMutation({
    mutationFn: async ({ id, is_frozen }: { id: string, is_frozen: boolean }) => {
      const { data, error } = await supabase
        .from('claim_shares')
        .update({ is_frozen })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
    }
  })

  const toggleMuteGuestMutation = useMutation({
    mutationFn: async ({ id, is_muted }: { id: string, is_muted: boolean }) => {
      const { data, error } = await supabase
        .from('claim_shares')
        .update({ is_muted })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
    }
  })

  const processPaymentMutation = useMutation({
    mutationFn: async ({ claimId, guestEmail, amount }: { claimId: string, guestEmail: string, amount: number }) => {
      setProcessingPayment(true)
      
      // In production, this would integrate with your Stripe account
      // The payment goes to the app owner (you), not the claim owner
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      
      // Mark all pending shares for this claim as paid (since payment covers all guests)
      const { data, error } = await supabase
        .from('claim_shares')
        .update({ 
          donation_paid: true,
          donation_paid_at: new Date().toISOString(),
          stripe_payment_intent_id: `pi_app_owner_${Date.now()}`
        })
        .eq('claim_id', claimId)
        .eq('donation_paid', false)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      queryClient.invalidateQueries({ queryKey: ['guest-counts'] })
      setShowPaymentModal(false)
      setPendingPayment(null)
      setProcessingPayment(false)
    },
    onError: () => {
      setProcessingPayment(false)
    }
  })

  const handlePayment = (claimId: string, guestEmail: string) => {
    const currentGuestCount = (guestCounts?.[claimId] || 0) + 1 // +1 for the new guest
    const amount = calculateDonationAmount(currentGuestCount)
    
    setPendingPayment({
      claimId,
      guestEmail,
      amount,
      guestCount: currentGuestCount
    })
    setShowPaymentModal(true)
  }

  const processPayment = () => {
    if (!pendingPayment) return
    processPaymentMutation.mutate({
      claimId: pendingPayment.claimId,
      guestEmail: pendingPayment.guestEmail,
      amount: pendingPayment.amount
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareData.email.trim() || !claimToShare) return
    
    // Calculate donation amount based on current guest count
    const currentGuestCount = (guestCounts?.[claimToShare] || 0) + 1
    const donationAmount = calculateDonationAmount(currentGuestCount)
    
    // If first guest (free), share directly. Otherwise, show payment modal
    if (donationAmount === 0) {
      shareClaimMutation.mutate({
        ...shareData,
        claim_id: claimToShare,
        donation_amount: 0
      })
    } else {
      // Show payment modal for paid guests
      handlePayment(claimToShare, shareData.email)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading shared claims...</div>
  }

  return (
    <div className="space-y-6">
      {selectedClaim && (
        <div className="border-l-4 rounded-lg p-4" style={{ 
          borderLeftColor: claimColor,
          backgroundColor: `${claimColor}10`
        }}>
          <p style={{ color: claimColor }}>
            Showing shared access for selected claim: <strong>{selectedClaim}</strong>
          </p>
        </div>
      )}
      
      {/* Pricing Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">Guest Access Pricing</h3>
        </div>
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
        <p className="text-blue-800 text-sm mt-3">
          <strong>Note:</strong> First guest is FREE! Payment required for additional guests. All payments support app development.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Shared Claims Collaboration</h2>
        <button
          onClick={() => setShowShareForm(true)}
          className="text-white px-4 py-2 rounded-lg hover:opacity-90 flex items-center space-x-2"
          style={{ backgroundColor: claimColor }}
        >
          <Plus className="w-4 h-4" />
          <span>Share Claim</span>
        </button>
      </div>

      {showShareForm && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Share a Claim</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2">
              {calculateDonationAmount((guestCounts?.[selectedClaim || claimToShare] || 0) + 1) === 0 ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">First Guest - FREE!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Payment Required</span>
                </>
              )}
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              Current guest count for this claim: <strong>{guestCounts?.[selectedClaim || claimToShare] || 0}</strong>
            </p>
            {calculateDonationAmount((guestCounts?.[selectedClaim || claimToShare] || 0) + 1) === 0 ? (
              <p className="text-green-700 text-sm">
                Your first guest is completely free! No payment required.
              </p>
            ) : (
              <p className="text-yellow-700 text-sm">
                Cost for next guest: <strong>£{calculateDonationAmount((guestCounts?.[selectedClaim || claimToShare] || 0) + 1)}</strong>
              </p>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Claim *</label>
              <select
                value={selectedClaim || claimToShare}
                onChange={(e) => setClaimToShare(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                disabled={!!selectedClaim}
                required
              >
                <option value="">Choose a claim to share...</option>
                {myClaims?.map((claim) => (
                  <option key={claim.case_number} value={claim.case_number}>
                    {claim.case_number} - {claim.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email Address *</label>
              <input
                type="email"
                value={shareData.email}
                onChange={(e) => setShareData({ ...shareData, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Enter the email of the person to share with"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Permission Level</label>
              <select
                value={shareData.permission}
                onChange={(e) => setShareData({ ...shareData, permission: e.target.value as any })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="view">View Only</option>
                <option value="edit">View & Edit</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="can-view-evidence"
                checked={shareData.can_view_evidence}
                onChange={(e) => setShareData({ ...shareData, can_view_evidence: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="can-view-evidence" className="text-sm">Allow viewing evidence</label>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={shareClaimMutation.isPending}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                {shareClaimMutation.isPending ? 'Processing...' : 
                 calculateDonationAmount((guestCounts?.[selectedClaim || claimToShare] || 0) + 1) === 0 ? 
                 'Share for Free' : 'Proceed to Payment'}
              </button>
              <button
                type="button"
                onClick={() => setShowShareForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && pendingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Complete Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={processingPayment}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Guest Access Payment</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Claim: {pendingPayment.claimId}</p>
                  <p>Guest Email: {pendingPayment.guestEmail}</p>
                  <p>Total Guests: {pendingPayment.guestCount}</p>
                  <p>Access Level: {shareData.permission === 'edit' ? 'View & Edit' : 'View Only'}</p>
                  <p>Evidence Access: {shareData.can_view_evidence ? 'Yes' : 'No'}</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-lg font-semibold text-green-600">
                    Payment Amount: £{pendingPayment.amount}
                  </span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  This payment supports app development and maintenance.
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-900 mb-2">Payment Information</h5>
                <p className="text-sm text-blue-800">
                  Payment will be processed securely through Stripe and sent to the app owner. 
                  For demonstration purposes, clicking "Process Payment" will simulate a successful payment.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={processPayment}
                  disabled={processingPayment}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {processingPayment ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Process Payment</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={processingPayment}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => toggleFreezeGuestMutation.mutate({ 
                  id: share.id, 
                  is_frozen: !share.is_frozen 
                })}
                className={`p-2 ${
                  share.is_frozen 
                    ? 'text-green-600 hover:text-green-800' 
                    : 'text-orange-600 hover:text-orange-800'
                }`}
                title={share.is_frozen ? 'Unfreeze guest' : 'Freeze guest'}
              >
                {share.is_frozen ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM12 9a3 3 0 110-6 3 3 0 010 6z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => toggleMuteGuestMutation.mutate({ 
                  id: share.id, 
                  is_muted: !share.is_muted 
                })}
                className={`p-2 ${
                  share.is_muted 
                    ? 'text-green-600 hover:text-green-800' 
                    : 'text-red-600 hover:text-red-800'
                }`}
                title={share.is_muted ? 'Unmute guest' : 'Mute guest'}
              >
                {share.is_muted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => deleteShareMutation.mutate(share.id)}
                className="text-red-600 hover:text-red-800 p-2"
                title="Remove share"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-5 h-5" style={{ color: claimColor }} />
                  <h3 className="text-lg font-semibold">
                    {share.claims.case_number} - {share.claims.title}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Mail className="w-4 h-4" />
                    <span>{share.profiles.email}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {share.permission === 'edit' ? (
                      <Edit className="w-4 h-4 text-green-600" />
                    ) : (
                      <Eye className="w-4 h-4 text-blue-600" />
                    )}
                    <span className="capitalize">{share.permission} Access</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      share.can_view_evidence 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {share.can_view_evidence ? 'Can View Evidence' : 'No Evidence Access'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      share.is_frozen 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {share.is_frozen ? 'Frozen' : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      share.is_muted 
                        ? 'bg-orange-100 text-orange-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {share.is_muted ? 'Muted' : 'Can Chat'}
                    </span>
                  </div>
                </div>
                {share.donation_required && (
                  <div className="mt-2 flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-600">
                      {share.donation_amount === 0 ? 'First Guest - FREE' : `App Owner Payment: £${share.donation_amount}`}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      share.donation_paid 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {share.donation_paid ? (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>{share.donation_amount === 0 ? 'Free' : 'Paid'}</span>
                          {share.donation_paid_at && (
                            <span className="text-xs">
                              on {new Date(share.donation_paid_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Payment Required</span>
                        </div>
                      )}
                    </span>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  Shared on {new Date(share.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => deleteShareMutation.mutate(share.id)}
                className="text-red-600 hover:text-red-800 p-2"
                title="Remove share"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {(!sharedClaims || sharedClaims.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            No shared claims yet. Share a claim to start collaborating!
          </div>
        )}
      </div>
    </div>
  )
}

export default SharedClaims