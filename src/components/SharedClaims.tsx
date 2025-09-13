import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import PaymentModal from './PaymentModal'
import CollaborationHub from './CollaborationHub'
import { Users, Mail, Eye, Edit, Trash2, Plus, DollarSign, CreditCard, CheckCircle, Clock, AlertCircle, X, UserPlus, UserMinus, Crown, FileText } from 'lucide-react'
import EvidenceManager from './EvidenceManager'

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
  currentUserId?: string
  isGuest?: boolean
}

const SharedClaims = ({ selectedClaim, claimColor = '#3B82F6', currentUserId, isGuest = false }: SharedClaimsProps) => {
  const [showShareForm, setShowShareForm] = useState(false)
  const [selectedSharedClaim, setSelectedSharedClaim] = useState<string | null>(null)
  const [claimToShare, setClaimToShare] = useState('')
  const [showJoinClaimForm, setShowJoinClaimForm] = useState(false)
  const [joinClaimId, setJoinClaimId] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCollaboration, setShowCollaboration] = useState(false)
  const [paymentData, setPaymentData] = useState<{
    amount: number
    claimId: string
    guestEmail: string
  } | null>(null)
  const [shareData, setShareData] = useState({
    email: '',
    permission: 'view' as const,
    can_view_evidence: false,
    is_frozen: false,
    is_muted: false
  })
  const [shareError, setShareError] = useState<string | null>(null)

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
          profiles!claim_shares_shared_with_id_fkey(email, full_name)
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

  // Query for claims I'm a guest on
  const { data: guestClaims } = useQuery({
    queryKey: ['guest-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('claim_shares')
        .select(`
          *,
          claims!inner(title, case_number, color),
          owner_profile:profiles!owner_id(email, full_name)
        `)
        .eq('shared_with_id', user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as (ClaimShare & { 
        claims: { title: string; case_number: string; color?: string }
        owner_profile: { email: string; full_name?: string }
      })[]
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

  // Query for available claims to join (public claims or by case number)
  const { data: availableClaims } = useQuery({
    queryKey: ['available-claims', joinClaimId],
    queryFn: async () => {
      if (!joinClaimId.trim()) return []
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // Search for claims by case number that user is not already part of
      const { data, error } = await supabase
        .from('claims')
        .select(`
          case_number, 
          title, 
          color,
          owner_profile:profiles!user_id(email, full_name)
        `)
        .ilike('case_number', `%${joinClaimId}%`)
        .neq('user_id', user.id) // Not my own claims
        .limit(5)
      
      if (error) throw error
      
      // Filter out claims I'm already a guest on
      const myGuestClaimIds = guestClaims?.map(gc => gc.claim_id) || []
      return data.filter(claim => !myGuestClaimIds.includes(claim.case_number))
    },
    enabled: joinClaimId.trim().length > 0
  })

  const shareClaimMutation = useMutation({
    mutationFn: async (shareInfo: typeof shareData & { claim_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // First, check if user exists with an account (must be registered)
      const { data: existingUser, error: userLookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', shareInfo.email)
        .maybeSingle()

      if (userLookupError) {
        console.error('Error looking up user:', userLookupError)
        throw new Error(`Error looking up user: ${userLookupError.message}`)
      }

      if (!existingUser) {
        // Show a more user-friendly error message
        throw new Error(`The email "${shareInfo.email}" is not registered. Please ask them to sign up at the app first, then try sharing again.`)
      }

      // Check if user is trying to share with themselves
      if (existingUser.id === user.id) {
        throw new Error('You cannot share a claim with yourself')
      }

      // Check if claim is already shared with this user
      const { data: existingShare } = await supabase
        .from('claim_shares')
        .select('id')
        .eq('claim_id', shareInfo.claim_id)
        .eq('shared_with_id', existingUser.id)
        .maybeSingle()

      if (existingShare) {
        throw new Error(`This claim is already shared with ${shareInfo.email}`)
      }

      // Calculate donation amount
      const currentGuestCount = (guestCounts?.[shareInfo.claim_id] || 0) + 1
      const donationAmount = calculateDonationAmount(currentGuestCount)
      
      if (donationAmount === 0) {
        // Free guest - create share directly
        const insertData = {
          claim_id: shareInfo.claim_id,
          owner_id: user.id,
          shared_with_id: existingUser.id,
          permission: shareInfo.permission,
          can_view_evidence: shareInfo.can_view_evidence,
          is_frozen: shareInfo.is_frozen,
          is_muted: shareInfo.is_muted,
          donation_paid: true,
          donation_amount: 0
        }
        
        const { data, error } = await supabase
          .from('claim_shares')
          .insert([insertData])
          .select()
          .single()

        if (error) {
          console.error('Claim share insert error:', error)
          throw error
        }
        
        return data
      } else {
        // Paid guest - trigger payment flow
        throw new Error('PAYMENT_REQUIRED')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      queryClient.invalidateQueries({ queryKey: ['guest-counts'] })
      setShowShareForm(false)
      setShareError(null)
      setShareData({
        email: '',
        permission: 'view',
        can_view_evidence: false,
        is_frozen: false,
        is_muted: false
      })
      setClaimToShare('')
    },
    onError: (error) => {
      if (error.message === 'PAYMENT_REQUIRED') {
        // Show payment modal
        const currentGuestCount = (guestCounts?.[claimToShare] || 0) + 1
        const amount = calculateDonationAmount(currentGuestCount)
        
        setPaymentData({
          amount: amount,
          claimId: claimToShare,
          guestEmail: shareData.email
        })
        setShowPaymentModal(true)
      } else {
        // Show error message for other errors (like user not found)
        setShareError(error.message)
      }
    }
  })

  const joinClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Check if claim exists and get owner info
      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .select('user_id, title')
        .eq('case_number', claimId)
        .single()

      if (claimError || !claim) {
        throw new Error('Claim not found or you do not have permission to join')
      }

      // Create a join request (in a real app, this might require approval)
      const { data, error } = await supabase
        .from('claim_shares')
        .insert([{
          claim_id: claimId,
          owner_id: claim.user_id,
          shared_with_id: user.id,
          permission: 'view',
          can_view_evidence: false,
          is_frozen: false,
          is_muted: false,
          donation_required: false, // Join requests are free initially
          donation_paid: true
        }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-claims'] })
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      setShowJoinClaimForm(false)
      setJoinClaimId('')
    }
  })

  const leaveClaimMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('claim_shares')
        .delete()
        .eq('id', shareId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-claims'] })
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
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

  const handlePaymentSuccess = (paymentIntentId: string) => {
    queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
    queryClient.invalidateQueries({ queryKey: ['guest-counts'] })
    setShowPaymentModal(false)
    setPaymentData(null)
    setShowShareForm(false)
    setShareData({
      email: '',
      permission: 'view',
      can_view_evidence: false,
      is_frozen: false,
      is_muted: false
    })
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const claimId = selectedClaim || claimToShare
    
    if (!shareData.email.trim() || !claimId) {
      return
    }
    
    shareClaimMutation.mutate({
      ...shareData,
      claim_id: claimId
    })
  }

  const handleJoinClaim = (claimId: string) => {
    if (window.confirm(`Do you want to request access to claim ${claimId}?`)) {
      joinClaimMutation.mutate(claimId)
    }
  }

  const handleLeaveClaim = (shareId: string, claimId: string) => {
    if (window.confirm(`Are you sure you want to leave claim ${claimId}? You will lose access to all claim data.`)) {
      leaveClaimMutation.mutate(shareId)
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

      {/* Collaboration Section */}
      {showCollaboration && selectedClaim && (
        <div className="bg-white rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold" style={{ color: claimColor }}>
              Collaboration Hub
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Chat, video calls, and whiteboard collaboration for this claim. 
              <span className="font-medium text-green-600"> Free collaboration included!</span>
            </p>
          </div>
          <div className="p-0">
            <CollaborationHub 
              selectedClaim={selectedClaim} 
              claimColor={claimColor}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}

      {/* Show message when collaboration is enabled but no claim is selected */}
      {showCollaboration && !selectedClaim && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-900">Collaboration Hub</h3>
          </div>
          <p className="text-yellow-800">
            Please select a claim from the list below to start collaborating with chat, video calls, and whiteboard features.
          </p>
        </div>
      )}
      
      {/* Claims I'm a Guest On */}
      {guestClaims && guestClaims.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <UserPlus className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">Claims I'm a Guest On</h3>
          </div>
          <div className="space-y-3">
            {guestClaims.map((guestClaim) => (
              <div key={guestClaim.id} className="bg-white p-4 rounded border border-green-300 flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: guestClaim.claims.color || '#3B82F6' }}
                    />
                    <h4 className="font-medium">{guestClaim.claims.case_number} - {guestClaim.claims.title}</h4>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <span>Hosted by: {guestClaim.owner_profile.email}</span>
                    <span className="ml-4">Access: {guestClaim.permission}</span>
                    {guestClaim.can_view_evidence && (
                      <span className="ml-4 text-green-600">Can view evidence</span>
                    )}
                    {guestClaim.is_frozen && (
                      <span className="ml-4 text-red-600 font-medium">FROZEN</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleLeaveClaim(guestClaim.id, guestClaim.claims.case_number)}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center space-x-1"
                >
                  <UserMinus className="w-3 h-3" />
                  <span>Leave</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Pricing Information - Hidden when collaboration is shown */}
      {!showCollaboration && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">Guest Access Pricing & Account Requirements</h3>
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
          Each user can be both a claim owner (hosting their own claims) and a guest (invited to others' claims).
        </p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Shared Claims Collaboration</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCollaboration(!showCollaboration)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span>{showCollaboration ? 'Hide' : 'Show'} Collaboration</span>
          </button>
          <button
            onClick={() => window.location.href = '#subscription'}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <Crown className="w-4 h-4" />
            <span>Subscription</span>
          </button>
          <button
            onClick={() => setShowJoinClaimForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Join Claim</span>
          </button>
          {!isGuest && (
            <button
              onClick={() => setShowShareForm(true)}
              className="text-white px-4 py-2 rounded-lg hover:opacity-90 flex items-center space-x-2"
              style={{ backgroundColor: claimColor }}
            >
              <Plus className="w-4 h-4" />
              <span>Share Claim</span>
            </button>
          )}
        </div>
      </div>

      {showJoinClaimForm && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Join a Claim</h3>
            <button
              onClick={() => setShowJoinClaimForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search by Case Number</label>
              <input
                type="text"
                value={joinClaimId}
                onChange={(e) => setJoinClaimId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Enter case number to search..."
              />
            </div>
            {availableClaims && availableClaims.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Available Claims:</h4>
                {availableClaims.map((claim) => (
                  <div key={claim.case_number} className="bg-gray-50 p-3 rounded border flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: claim.color || '#3B82F6' }}
                        />
                        <span className="font-medium">{claim.case_number} - {claim.title}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Hosted by: {claim.owner_profile?.email || 'Unknown'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinClaim(claim.case_number)}
                      disabled={joinClaimMutation.isPending}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {joinClaimMutation.isPending ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {joinClaimId.trim() && availableClaims && availableClaims.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                No available claims found for "{joinClaimId}"
              </div>
            )}
          </div>
        </div>
      )}

      {showShareForm && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Share a Claim</h3>
          {(selectedClaim || claimToShare) && (
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
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800 text-sm font-medium">
                ⚠️ Account Required: The person you're inviting must have a registered account on this app.
              </p>
              <p className="text-blue-700 text-xs mt-1">
                They can create their own claims and invite their own guests.
              </p>
            </div>
            </div>
          )}
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
              {!selectedClaim && !claimToShare && (
                <p className="text-sm text-gray-600 mt-1">
                  Please select a claim to share before proceeding.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email Address *</label>
              <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <p className="text-blue-800 font-medium">Account Required</p>
                <p className="text-blue-700 text-xs">
                  The person must already have an account on this app. If they don't have an account, 
                  ask them to register first, then you can add them as a guest.
                </p>
              </div>
              <input
                type="email"
                value={shareData.email}
                onChange={(e) => {
                  setShareData({ ...shareData, email: e.target.value })
                  if (shareError) setShareError(null) // Clear error when user types
                }}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Enter the email of a registered user"
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
            
            {/* Error Display */}
            {shareError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-red-700 text-sm">{shareError}</p>
                </div>
                <button
                  onClick={() => setShareError(null)}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            
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
      {showPaymentModal && paymentData && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          amount={paymentData.amount}
          currency="gbp"
          paymentType="guest_access"
          claimId={paymentData.claimId}
          guestEmail={paymentData.guestEmail}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
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
              <div className="flex items-center space-x-2">
                {share.can_view_evidence && (
                  <button
                    onClick={() => setSelectedSharedClaim(share.claims.case_number)}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    title="View Evidence"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
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
            </div>
          </div>
        ))}
        {(!sharedClaims || sharedClaims.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            No shared claims yet. Share a claim to start collaborating!
          </div>
        )}
      </div>

      {/* Evidence Manager for selected shared claim */}
      {selectedSharedClaim && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Evidence for {selectedSharedClaim}</h3>
            <button
              onClick={() => setSelectedSharedClaim(null)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Close Evidence</span>
            </button>
          </div>
          <EvidenceManager 
            selectedClaim={selectedSharedClaim} 
            claimColor={claimColor} 
            isGuest={true}
            currentUserId={currentUserId}
            isGuestFrozen={false}
          />
        </div>
      )}
    </div>
  )
}

export default SharedClaims