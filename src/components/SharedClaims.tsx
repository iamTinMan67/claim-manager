import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Users, Mail, Eye, Edit, Trash2, Plus, DollarSign } from 'lucide-react'

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

const SharedClaims = () => {
  const [showShareForm, setShowShareForm] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState('')
  const [shareData, setShareData] = useState({
    email: '',
    permission: 'view' as const,
    can_view_evidence: false,
    donation_required: false,
    donation_amount: ''
  })

  const queryClient = useQueryClient()

  const { data: sharedClaims, isLoading } = useQuery({
    queryKey: ['shared-claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_shares')
        .select(`
          *,
          claims!inner(title, case_number),
          profiles!shared_with_id(email, full_name)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as ClaimShare[]
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
      setSelectedClaim('')
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareData.email.trim() || !selectedClaim) return
    shareClaimMutation.mutate({ ...shareData, claim_id: selectedClaim })
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading shared claims...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Shared Claims Collaboration</h2>
        <button
          onClick={() => setShowShareForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Share Claim</span>
        </button>
      </div>

      {showShareForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Share a Claim</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Claim *</label>
              <select
                value={selectedClaim}
                onChange={(e) => setSelectedClaim(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
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
                  value={shareData.donation_amount}
                  onChange={(e) => setShareData({ ...shareData, donation_amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Enter amount in dollars"
                />
              </div>
            )}
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={shareClaimMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

      <div className="space-y-4">
        {sharedClaims?.map((share) => (
          <div key={share.id} className="bg-white p-6 rounded-lg shadow border">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
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
                      {share.donation_paid ? 'Paid' : 'Pending'}
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