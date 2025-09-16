import React from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Claim } from '@/types/database'
import { Edit, Trash2, Plus, X, Settings, Home } from 'lucide-react'
import EvidenceManager from './EvidenceManager'

interface ClaimsTableProps {
  onClaimSelect: (claimId: string | null) => void
  selectedClaim: string | null
  onClaimColorChange: (color: string) => void
  isGuest?: boolean
}

const ClaimsTable = ({ onClaimSelect, selectedClaim, onClaimColorChange, isGuest = false }: ClaimsTableProps) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null)
  const [amendMode, setAmendMode] = useState(false)
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

  // Get current user for permission checks
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    }
  })

  // Check if current user is a guest and if they're frozen
  const { data: guestStatus } = useQuery({
    queryKey: ['guest-status', selectedClaim, currentUser?.id],
    queryFn: async () => {
      if (!selectedClaim || !currentUser?.id) return null
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select('is_frozen, is_muted')
        .eq('claim_id', selectedClaim)
        .eq('shared_with_id', currentUser.id)
        .maybeSingle()
      
      if (error) return null
      return data
    },
    enabled: !!selectedClaim && !!currentUser?.id && isGuest
  })

  const { data: claims, isLoading, error } = useQuery({
    queryKey: ['claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let query = supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (isGuest) {
        // If user is a guest, show only shared claims they have access to
        const { data: sharedClaimIds } = await supabase
          .from('claim_shares')
          .select('claim_id')
          .eq('shared_with_id', user.id)
        
        if (sharedClaimIds && sharedClaimIds.length > 0) {
          const claimIds = sharedClaimIds.map(share => share.claim_id)
          query = query.in('case_number', claimIds)
        } else {
          // No shared claims, return empty array
          return []
        }
      } else {
        // Show user's own claims
        query = query.eq('user_id', user.id)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data as Claim[]
    }
  })

  const addClaimMutation = useMutation({
    mutationFn: async (claimData: typeof newClaim) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('claims')
        .insert([{ ...claimData, user_id: user.id }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
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

  const updateClaimMutation = useMutation({
    mutationFn: async ({ case_number, data }: { case_number: string, data: Partial<Claim> }) => {
      const { data: result, error } = await supabase
        .from('claims')
        .update(data)
        .eq('case_number', case_number)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      setEditingClaim(null)
    }
  })

  const deleteClaimMutation = useMutation({
    mutationFn: async (case_number: string) => {
      const { error } = await supabase
        .from('claims')
        .delete()
        .eq('case_number', case_number)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      if (selectedClaim) {
        onClaimSelect(null)
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClaim.case_number.trim() || !newClaim.title.trim()) return
    addClaimMutation.mutate(newClaim)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClaim) return
    updateClaimMutation.mutate({
      case_number: editingClaim.case_number,
      data: editingClaim
    })
  }

  const handleClaimSelect = (claim: Claim) => {
    onClaimSelect(claim.case_number)
    onClaimColorChange(claim.color || '#3B82F6')
  }

  const getClaimColors = () => [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading claims...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-enhanced p-4 border-red-400/50">
        <div className="text-red-200">Error loading claims: {error.message}</div>
      </div>
    )
  }

  // If a claim is selected, show only that claim with evidence subform
  if (selectedClaim) {
    const claim = claims?.find(c => c.case_number === selectedClaim)
    if (!claim) return <div>Claim not found</div>

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gold">Claim Details</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.history.back()}
              className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => onClaimSelect(null)}
              className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
          </div>
        </div>
        
        {/* Evidence Management */}
        <EvidenceManager 
          selectedClaim={selectedClaim} 
          claimColor={claim.color || '#3B82F6'} 
          amendMode={amendMode}
          isGuest={isGuest}
          currentUserId={currentUser?.id}
          isGuestFrozen={guestStatus?.is_frozen || false}
          onEditClaim={() => setEditingClaim(claim)}
          onDeleteClaim={() => deleteClaimMutation.mutate(claim.case_number)}
          onSetAmendMode={setAmendMode}
        />
      </div>
    )
  }

  // Show all claims in boxes
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gold">
          {isGuest ? 'Shared Claims' : 'Claims'}
        </h2>
        {!isGuest && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Claim</span>
          </button>
        )}
      </div>

      {showAddForm && !isGuest && (
        <div className="card-enhanced p-6">
          <h3 className="text-lg font-semibold mb-4 text-gold">Add New Claim</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Case Number *</label>
                <input
                  type="text"
                  value={newClaim.case_number}
                  onChange={(e) => setNewClaim({ ...newClaim, case_number: e.target.value, title: newClaim.title || e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={newClaim.status}
                  onChange={(e) => setNewClaim({ ...newClaim, status: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                >
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Appealing">Appealing</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Court</label>
                <input
                  type="text"
                  value={newClaim.court}
                  onChange={(e) => setNewClaim({ ...newClaim, court: e.target.value })}
                  className="w-2/3 border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plaintiff</label>
                <input
                  type="text"
                  value={newClaim.plaintiff_name}
                  onChange={(e) => setNewClaim({ ...newClaim, plaintiff_name: e.target.value })}
                  className="w-2/3 border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Defendant</label>
                <input
                  type="text"
                  value={newClaim.defendant_name}
                  onChange={(e) => setNewClaim({ ...newClaim, defendant_name: e.target.value })}
                  className="w-2/3 border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newClaim.description}
                onChange={(e) => setNewClaim({ ...newClaim, description: e.target.value })}
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Claim Color</label>
              <div className="flex space-x-2">
                {getClaimColors().map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewClaim({ ...newClaim, color })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newClaim.color === color ? 'border-gray-800' : 'border-gray-300'
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
                className="btn-gold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {addClaimMutation.isPending ? 'Adding...' : 'Add Claim'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-yellow-400/20 text-gold px-4 py-2 rounded-lg hover:bg-yellow-400/30"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingClaim && !isGuest && (
        <div className="card-enhanced p-6">
          <h3 className="text-lg font-semibold mb-4 text-gold">Edit Claim</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Case Number *</label>
                <input
                  type="text"
                  value={editingClaim.case_number}
                  onChange={(e) => setEditingClaim({ ...editingClaim, case_number: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={editingClaim.title}
                  onChange={(e) => setEditingClaim({ ...editingClaim, title: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Court</label>
                <input
                  type="text"
                  value={editingClaim.court || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, court: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plaintiff</label>
                <input
                  type="text"
                  value={editingClaim.plaintiff_name || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, plaintiff_name: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Defendant</label>
                <input
                  type="text"
                  value={editingClaim.defendant_name || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, defendant_name: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editingClaim.description || ''}
                onChange={(e) => setEditingClaim({ ...editingClaim, description: e.target.value })}
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Claim Color</label>
              <div className="flex space-x-2">
                {getClaimColors().map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditingClaim({ ...editingClaim, color })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      editingClaim.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={updateClaimMutation.isPending}
                className="btn-gold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {updateClaimMutation.isPending ? 'Updating...' : 'Update Claim'}
              </button>
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="bg-yellow-400/20 text-gold px-4 py-2 rounded-lg hover:bg-yellow-400/30"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Claims Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {claims?.map((claim) => (
          <div
            key={claim.case_number}
            className="card-enhanced p-6 cursor-pointer hover:shadow-lg transition-shadow border-l-4"
            style={{ borderLeftColor: claim.color || '#3B82F6' }}
            onClick={() => handleClaimSelect(claim)}
          >
            <div className="flex justify-between items-start mb-4">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: claim.color || '#3B82F6' }}
              />
              <div className="flex items-center space-x-2">
                {!isGuest && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingClaim(claim)
                      }}
                      className="text-blue-600 hover:text-blue-800 p-1"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteClaimMutation.mutate(claim.case_number)
                      }}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-semibold mb-2">{claim.title}</h3>
            <p className="text-sm text-gray-600 mb-2">Case: {claim.case_number}</p>
            {claim.court && (
              <p className="text-sm text-gray-600 mb-2">Court: {claim.court}</p>
            )}
            
            <div className="flex justify-between items-center mt-4">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                claim.status === 'Active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {claim.status}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(claim.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {(!claims || claims.length === 0) && (
        <div className="card-enhanced p-8 text-center">
          <div className="text-gold-light">No claims found. Create your first claim to get started!</div>
        </div>
      )}
    </div>
  )
}

export default ClaimsTable