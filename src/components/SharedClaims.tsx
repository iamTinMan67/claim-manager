import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Users, Mail, Eye, Edit, Trash2, Plus, DollarSign, CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface ClaimShare {
  id: string
  claim_id: string
  owner_id: string
  shared_with_id: string
  permission: 'view' | 'edit'
  can_view_evidence: boolean
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
  const [showDonationModal, setShowDonationModal] = useState(false)
  const [selectedShareForDonation, setSelectedShareForDonation] = useState<ClaimShare | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [shareData, setShareData] = useState({
    email: '',
    permission: 'view' as const,
    can_view_evidence: false,
    donation_required: false,
    donation_amount: ''
  })

  const queryClient = useQueryClient()

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

  // Query for shares where current user needs to pay donation
  const { data: pendingDonations } = useQuery({
    queryKey: ['pending-donations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('claim_shares')
        .select(`
          *,
          claims!inner(title, case_number),
          profiles!owner_id(email, full_name)
        `)
        .eq('shared_with_id', user.id)
        .eq('donation_required', true)
        .eq('donation_paid', false)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as (ClaimShare & { 
        profiles: { email: string, full_name?: string } 
      })[]
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
    mutationFn: async (shareInfo: typeof shareData & { claim_id: string }) => {
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
          donation_required: shareInfo.donation_required,
          donation_amount: shareInfo.donation_amount ? parseInt(shareInfo.donation_amount) : null
        }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      setShowShareForm(false)
      setShareData({
        email: '',
        permission: 'view',
        can_view_evidence: false,
        donation_required: false,
        donation_amount: ''
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
    }
  })

  const processDonationMutation = useMutation({
    mutationFn: async ({ shareId, amount }: { shareId: string, amount: number }) => {
      setProcessingPayment(true)
      
      // In a real implementation, you would integrate with Stripe here
      // For now, we'll simulate the payment process
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      
      // Update the share record to mark donation as paid
      const { data, error } = await supabase
        .from('claim_shares')
        .update({ 
          donation_paid: true,
          donation_paid_at: new Date().toISOString(),
          stripe_payment_intent_id: `pi_simulated_${Date.now()}`
        })
        .eq('id', shareId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      queryClient.invalidateQueries({ queryKey: ['pending-donations'] })
      setShowDonationModal(false)
      setSelectedShareForDonation(null)
      setProcessingPayment(false)
    },
    onError: () => {
      setProcessingPayment(false)
    }
  })

  const handleDonationPayment = (share: ClaimShare) => {
    setSelectedShareForDonation(share)
    setShowDonationModal(true)
  }

  const processDonation = () => {
    if (!selectedShareForDonation) return
    processDonationMutation.mutate({
      shareId: selectedShareForDonation.id,
      amount: selectedShareForDonation.donation_amount || 0
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareData.email.trim() || !claimToShare) return
    shareClaimMutation.mutate({ ...shareData, claim_id: claimToShare })
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
      
      {/* Pending Donations Section */}
      {pendingDonations && pendingDonations.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-orange-900">Pending Donations Required</h3>
          </div>
          <p className="text-orange-800 mb-4">
            You have access to shared claims that require donations. Complete your donations to gain full access.
          </p>
          <div className="space-y-3">
            {pendingDonations.map((share) => (
              <div key={share.id} className="bg-white p-4 rounded-lg border border-orange-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {share.claims.case_number} - {share.claims.title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Shared by: {share.profiles.email}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        Donation Required: ${share.donation_amount}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDonationPayment(share)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay Donation</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="donation-required"
                checked={shareData.donation_required}
                onChange={(e) => setShareData({ ...shareData, donation_required: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="donation-required" className="text-sm">Require donation for access</label>
            </div>
            {shareData.donation_required && (
              <div>
                <label className="block text-sm font-medium mb-1">Donation Amount ($)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={shareData.donation_amount}
                  onChange={(e) => setShareData({ ...shareData, donation_amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Enter amount in dollars (minimum $1)"
                />
              </div>
            )}
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={shareClaimMutation.isPending}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                {shareClaimMutation.isPending ? 'Sharing...' : 'Share Claim'}
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

      {/* Donation Payment Modal */}
      {showDonationModal && selectedShareForDonation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Complete Donation</h3>
              <button
                onClick={() => setShowDonationModal(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={processingPayment}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  {selectedShareForDonation.claims.case_number} - {selectedShareForDonation.claims.title}
                </h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Shared by: {selectedShareForDonation.profiles.email}</p>
                  <p>Access Level: {selectedShareForDonation.permission === 'edit' ? 'View & Edit' : 'View Only'}</p>
                  <p>Evidence Access: {selectedShareForDonation.can_view_evidence ? 'Yes' : 'No'}</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-lg font-semibold text-green-600">
                    Donation Amount: ${selectedShareForDonation.donation_amount}
                  </span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  This donation helps support the claim owner's legal efforts.
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-900 mb-2">Payment Information</h5>
                <p className="text-sm text-blue-800">
                  In a production environment, this would integrate with Stripe for secure payment processing. 
                  For demonstration purposes, clicking "Process Donation" will simulate a successful payment.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={processDonation}
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
                      <span>Process Donation</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDonationModal(false)}
                  disabled={processingPayment}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sharedClaims?.map((share) => (
          <div key={share.id} className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
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
                </div>
                {share.donation_required && (
                  <div className="mt-2 flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-600">
                      Donation Required: ${share.donation_amount}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      share.donation_paid 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {share.donation_paid ? (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Paid</span>
                          {share.donation_paid_at && (
                            <span className="text-xs">
                              on {new Date(share.donation_paid_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Pending Payment</span>
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