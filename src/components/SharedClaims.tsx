import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import PaymentModal from './PaymentModal'
import CollaborationHub from './CollaborationHub'
import { Users, Mail, Eye, Edit, Trash2, Plus, DollarSign, CreditCard, CheckCircle, Clock, AlertCircle, X, UserPlus, UserMinus, Crown, FileText, Moon, Sun } from 'lucide-react'
import EvidenceManager from './EvidenceManager'
import { useTheme } from 'next-themes'

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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCollaboration, setShowCollaboration] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
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
  const [newClaim, setNewClaim] = useState({
    case_number: '',
    title: '',
    court: '',
    plaintiff_name: '',
    defendant_name: '',
    description: '',
    status: 'Active',
    color: '#3B82F6'
  })

  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()

  // Check if current user is a guest and if they're frozen
  const { data: guestStatus } = useQuery({
    queryKey: ['guest-status', selectedClaim, currentUserId],
    queryFn: async () => {
      if (!selectedClaim || !currentUserId || !isGuest) return null
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select('is_frozen, is_muted')
        .eq('claim_id', selectedClaim)
        .eq('shared_with_id', currentUserId)
        .maybeSingle()
      
      if (error) return null
      return data
    },
    enabled: !!selectedClaim && !!currentUserId && isGuest
  })

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
    queryKey: ['shared-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('claim_shares')
        .select(`
          *,
          claims!inner(title, case_number, color, user_id),
          profiles!claim_shares_shared_with_id_fkey(email, full_name)
        `)
        .eq('owner_id', user.id) // Only show claims I own
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
          claims!inner(title, case_number, color, user_id),
          owner_profile:profiles!owner_id(email, full_name)
        `)
        .eq('shared_with_id', user.id)
        .neq('owner_id', user.id) // Exclude claims where user is the owner
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

  // Add claim mutation
  const addClaimMutation = useMutation({
    mutationFn: async (claimData: typeof newClaim) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('claims')
        .insert([{
          ...claimData,
          user_id: user.id
        }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      setShowAddForm(false)
      setNewClaim({
        case_number: '',
        title: '',
        court: '',
        plaintiff_name: '',
        defendant_name: '',
        description: '',
        status: 'Active',
        color: '#3B82F6'
      })
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
    // Handle payment error silently
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


  const handleLeaveClaim = (shareId: string, claimId: string) => {
    if (window.confirm(`Are you sure you want to leave claim ${claimId}? You will lose access to all claim data.`)) {
      leaveClaimMutation.mutate(shareId)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading shared claims...</div>
  }

  return (
    <div className="space-y-4">

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
              isGuest={isGuest}
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
      
      

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gold">Shared Claims</h2>
        <div className="flex items-center space-x-3">
        {!isGuest && !selectedClaim && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Claim</span>
          </button>
        )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-yellow-400/20 transition-colors text-gold"
            title="Toggle dark mode"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>


      {showShareForm && (
        <div className="card-enhanced p-6 border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4 text-gold">Share a Claim</h3>
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
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
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
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                placeholder="Enter the email of a registered user"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Permission Level</label>
              <select
                value={shareData.permission}
                onChange={(e) => setShareData({ ...shareData, permission: e.target.value as any })}
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
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
                className="bg-yellow-400/20 text-gold px-4 py-2 rounded-lg hover:bg-yellow-400/30"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Claim Form */}
      {showAddForm && !isGuest && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Add New Claim</h3>
          <form onSubmit={(e) => {
            e.preventDefault()
            addClaimMutation.mutate(newClaim)
          }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Case Number *</label>
                <input
                  type="text"
                  value={newClaim.case_number}
                  onChange={(e) => setNewClaim({ ...newClaim, case_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., KB2025LIV000075"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Title *</label>
                <input
                  type="text"
                  value={newClaim.title}
                  onChange={(e) => setNewClaim({ ...newClaim, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., Personal Injury Claim"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Court</label>
                <input
                  type="text"
                  value={newClaim.court}
                  onChange={(e) => setNewClaim({ ...newClaim, court: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., Liverpool County Court"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Status</label>
                <select
                  value={newClaim.status}
                  onChange={(e) => setNewClaim({ ...newClaim, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Settled">Settled</option>
                  <option value="Dismissed">Dismissed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Plaintiff Name</label>
                <input
                  type="text"
                  value={newClaim.plaintiff_name}
                  onChange={(e) => setNewClaim({ ...newClaim, plaintiff_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Defendant Name</label>
                <input
                  type="text"
                  value={newClaim.defendant_name}
                  onChange={(e) => setNewClaim({ ...newClaim, defendant_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., ABC Insurance Ltd"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description</label>
              <textarea
                value={newClaim.description}
                onChange={(e) => setNewClaim({ ...newClaim, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                rows={3}
                placeholder="Brief description of the claim..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Color</label>
              <div className="flex space-x-2">
                {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewClaim({ ...newClaim, color })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newClaim.color === color ? 'border-gray-800 dark:border-white' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={addClaimMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addClaimMutation.isPending ? 'Adding...' : 'Add Claim'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
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

      {/* Claims Grid - Only show when no claim is selected */}
      {!selectedClaim && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Claims I Own (Host) - Filter out any that also appear as guest claims */}
          {sharedClaims?.filter(share => 
            !guestClaims?.some(guest => guest.claims.case_number === share.claims.case_number)
          ).map((share) => (
            <div
              key={share.id}
              className="card-enhanced p-6 cursor-pointer hover:shadow-lg transition-shadow border-l-4"
              style={{ borderLeftColor: share.claims.color || '#3B82F6' }}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href)
                  url.searchParams.set('claim', share.claims.case_number)
                  window.history.pushState({}, '', url.toString())
                }
                window.dispatchEvent(new CustomEvent('claimSelected', {
                  detail: {
                    claimId: share.claims.case_number,
                    claimColor: share.claims.color || '#3B82F6'
                  }
                }))
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: share.claims.color || '#3B82F6' }}
                />
                <div className="flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-purple-600" title="You own this claim" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-2 dark:text-white">
                {share.claims.case_number}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">{share.claims.title}</p>
              
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Shared with: {share.profiles.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {share.permission === 'edit' ? (
                    <Edit className="w-4 h-4 text-green-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="capitalize">{share.permission} Access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    share.can_view_evidence 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {share.can_view_evidence ? 'Can View Evidence' : 'No Evidence Access'}
                  </span>
                </div>
              </div>
              
              {share.donation_required && (
                <div className="mt-4 p-2 bg-yellow-50 dark:bg-yellow-900 rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-yellow-800 dark:text-yellow-200">
                      {share.donation_amount === 0 ? 'First Guest - FREE' : `Payment: £${share.donation_amount}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Claims I'm a Guest On */}
          {guestClaims?.map((guestClaim) => (
            <div
              key={guestClaim.id}
              className="card-enhanced p-6 cursor-pointer hover:shadow-lg transition-shadow border-l-4"
              style={{ borderLeftColor: guestClaim.claims.color || '#3B82F6' }}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href)
                  url.searchParams.set('claim', guestClaim.claims.case_number)
                  window.history.pushState({}, '', url.toString())
                }
                window.dispatchEvent(new CustomEvent('claimSelected', { 
                  detail: { 
                    claimId: guestClaim.claims.case_number,
                    claimColor: guestClaim.claims.color || '#3B82F6'
                  } 
                }))
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: guestClaim.claims.color || '#3B82F6' }}
                />
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-4 h-4 text-green-600" title="You're a guest on this claim" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-2 dark:text-white">
                {guestClaim.claims.case_number}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">{guestClaim.claims.title}</p>
              
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Hosted by: {guestClaim.owner_profile.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {guestClaim.permission === 'edit' ? (
                    <Edit className="w-4 h-4 text-green-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="capitalize">{guestClaim.permission} Access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    guestClaim.can_view_evidence 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {guestClaim.can_view_evidence ? 'Can View Evidence' : 'No Evidence Access'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Claim Details View - Show when claim is selected */}
      {selectedClaim && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gold">Claim Details</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href)
                    url.searchParams.delete('claim')
                    window.history.pushState({}, '', url.toString())
                  }
                  window.dispatchEvent(new CustomEvent('claimSelected', { detail: { claimId: null, claimColor: '#3B82F6' } }))
                }}
                className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Back to All Claims</span>
              </button>
            </div>
          </div>
          
          
          {/* Evidence Management */}
          <EvidenceManager 
            selectedClaim={selectedClaim} 
            claimColor={claimColor} 
            amendMode={false}
            isGuest={isGuest}
            currentUserId={currentUserId}
            isGuestFrozen={guestStatus?.is_frozen || false}
            onEditClaim={() => {}}
            onDeleteClaim={() => {}}
            onSetAmendMode={() => {}}
          />

          {/* Action Buttons */}
          <div className="mt-8 p-6 card-enhanced">
            <h3 className="text-lg font-semibold mb-4 text-gold">Claim Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowCollaboration(!showCollaboration)}
                className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span>{showCollaboration ? 'Hide' : 'Show'} Collaboration</span>
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('tabChange', { detail: 'subscription' }))
                }}
                className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Crown className="w-4 h-4" />
                <span>Subscription</span>
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
        </div>
      )}

      {!selectedClaim && (!sharedClaims || sharedClaims.length === 0) && (!guestClaims || guestClaims.length === 0) && (
        <div className="text-center py-8 text-gold-light">
          No shared claims yet. Add a claim and share it, or wait for someone to share with you!
        </div>
      )}

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
            isGuest={isGuest}
            currentUserId={currentUserId}
            isGuestFrozen={false}
          />
        </div>
      )}
    </div>
  )
}

export default SharedClaims