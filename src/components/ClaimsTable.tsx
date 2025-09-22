import React from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Claim } from '@/types/database'
import { Edit, Trash2, Plus, X, Settings, Home, ChevronLeft } from 'lucide-react'
import { useNavigation } from '@/contexts/NavigationContext'
import EvidenceManager from './EvidenceManager'
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils'

interface ClaimsTableProps {
  onClaimSelect: (claimId: string | null) => void
  selectedClaim: string | null
  onClaimColorChange: (color: string) => void
  isGuest?: boolean
}

const ClaimsTable = ({ onClaimSelect, selectedClaim, onClaimColorChange, isGuest = false }: ClaimsTableProps) => {
  const { navigateBack, navigateTo } = useNavigation()
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
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})

  const queryClient = useQueryClient()

  // Auto-complete functionality - load saved form data
  const loadFormData = () => {
    const savedData = localStorage.getItem('claimFormData')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setNewClaim(prev => ({ ...prev, ...parsed, status: 'Active', color: '#3B82F6' }))
      } catch (error) {
        console.error('Error loading form data:', error)
      }
    }
  }

  // Save form data to localStorage
  const saveFormData = (data: typeof newClaim) => {
    const dataToSave = {
      case_number: data.case_number,
      title: data.title,
      court: data.court,
      plaintiff_name: data.plaintiff_name,
      defendant_name: data.defendant_name,
      description: data.description
    }
    localStorage.setItem('claimFormData', JSON.stringify(dataToSave))
  }

  // Load form data when component mounts
  React.useEffect(() => {
    loadFormData()
  }, [])

  // Clear error when user starts typing
  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

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
      
      const claimId = await getClaimIdFromCaseNumber(selectedClaim)
      if (!claimId) return null
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select('is_frozen, is_muted')
        .eq('claim_id', claimId)
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
      
      console.log('ClaimsTable: Fetching claims for user:', user.id, 'isGuest:', isGuest)

      let query = supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (isGuest) {
        // If user is a guest, show only shared claims they have access to
        const { data: sharedClaimIds, error: shareError } = await supabase
          .from('claim_shares')
          .select('claim_id')
          .eq('shared_with_id', user.id)
        
        if (shareError) {
          console.error('Error fetching shared claims:', shareError)
          throw shareError
        }
        
        if (sharedClaimIds && sharedClaimIds.length > 0) {
          const claimIds = sharedClaimIds.map(share => share.claim_id).filter(Boolean)
          console.log('Shared claim IDs:', claimIds)
          query = query.in('claim_id', claimIds)
        } else {
          // No shared claims, return empty array
          return []
        }
      } else {
        // Show user's own claims
        query = query.eq('user_id', user.id)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Claims query error:', error)
        throw error
      }
      
      console.log('ClaimsTable: Claims data received:', data)
      console.log('ClaimsTable: Query was for isGuest:', isGuest)
      console.log('ClaimsTable: User ID:', user.id)
      return data as Claim[]
    }
  })

  const addClaimMutation = useMutation({
    mutationFn: async (claimData: typeof newClaim) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Check if case number already exists
      const { data: existingClaim, error: checkError } = await supabase
        .from('claims')
        .select('case_number')
        .eq('case_number', claimData.case_number)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is what we want
        console.error('Check error:', checkError)
        throw checkError
      }

      if (existingClaim) {
        throw new Error('Case number already exists. Please choose a different case number.')
      }

      const { data, error } = await supabase
        .from('claims')
        .insert([{ ...claimData, user_id: user.id }])
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        throw error
      }
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
    },
    onError: (error) => {
      console.error('Add claim error:', error)
      // Show user-friendly error message for case number uniqueness
      if (error.message.includes('Case number already exists')) {
        setFormErrors({ case_number: 'This case number already exists. Please choose a different one.' })
      }
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
    
    // Clear previous errors
    setFormErrors({})
    
    // Validate required fields
    const errors: {[key: string]: string} = {}
    
    if (!newClaim.title.trim()) {
      errors.title = 'Claim Title is required'
    }
    
    if (!newClaim.case_number.trim()) {
      errors.case_number = 'Case Number is required'
    }
    
    // If there are validation errors, set them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    
    // Remove color field as it doesn't exist in database schema
    const { color, ...claimDataWithoutColor } = newClaim
    
    const claimData = {
      ...claimDataWithoutColor,
      description: newClaim.description || ''
    }
    
    addClaimMutation.mutate(claimData)
    
    // Save form data for auto-complete
    saveFormData(newClaim)
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
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                try {
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href)
                    url.searchParams.delete('claim')
                    window.history.pushState({}, '', url.toString())
                  }
                  window.dispatchEvent(new CustomEvent('claimSelected', { detail: { claimId: null } }))
                  window.dispatchEvent(new CustomEvent('tabChange', { detail: 'claims' }))
                  sessionStorage.setItem('welcome_seen_session', '1')
                } catch {}
                navigateTo('claims')
              }}
              className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            {isGuest && (
              <button
                onClick={() => { try { sessionStorage.setItem('welcome_seen_session', '1') } catch {}; navigateTo('claims') }}
                className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gold text-center flex-1">Claim Details</h2>
          <div />
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
      {showAddForm && !isGuest ? (
        // Form overlay - hide main content
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card-enhanced p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gold">Add New Claim</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    // Reset form for new claim
                    const currentMatch = newClaim.case_number.match(/(\d+)/);
                    const nextNum = currentMatch ? parseInt(currentMatch[1], 10) + 1 : 1;
                    setNewClaim({
                      case_number: '',
                      title: '',
                      court: '',
                      plaintiff_name: '',
                      defendant_name: '',
                      description: '',
                      status: 'Active',
                      color: '#3B82F6'
                    });
                    setFormErrors({});
                    loadFormData();
                  }}
                  className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2 hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another</span>
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="bg-white/10 border border-red-400 text-red-400 px-3 py-1 rounded-lg flex items-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Claim Title *</label>
                  <input
                    type="text"
                    value={newClaim.title}
                    onChange={(e) => {
                      const updated = { ...newClaim, title: e.target.value }
                      setNewClaim(updated)
                      clearError('title')
                      saveFormData(updated)
                    }}
                    className={`w-full border rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:ring-2 ${
                      formErrors.title 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                        : 'border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400/20'
                    }`}
                    placeholder="e.g., Property Damage Claim"
                    style={{ width: 'calc(66.666667% + 25px)' }}
                    required
                  />
                  {formErrors.title && (
                    <p className="text-red-400 text-sm mt-1">{formErrors.title}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Case Number *</label>
                  <input
                    type="text"
                    value={newClaim.case_number}
                    onChange={(e) => {
                      const updated = { ...newClaim, case_number: e.target.value }
                      setNewClaim(updated)
                      clearError('case_number')
                      saveFormData(updated)
                    }}
                    className={`w-full border rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:ring-2 ${
                      formErrors.case_number 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                        : 'border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400/20'
                    }`}
                    placeholder="e.g., CV-2024-001"
                    style={{ width: 'calc(66.666667% + 25px)' }}
                    required
                  />
                  {formErrors.case_number && (
                    <p className="text-red-400 text-sm mt-1">{formErrors.case_number}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Court</label>
                  <input
                    type="text"
                    value={newClaim.court}
                    onChange={(e) => {
                      const updated = { ...newClaim, court: e.target.value }
                      setNewClaim(updated)
                      saveFormData(updated)
                    }}
                    className="w-2/3 border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                    style={{ width: 'calc(66.666667% + 25px)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={newClaim.status}
                    onChange={(e) => {
                      const updated = { ...newClaim, status: e.target.value }
                      setNewClaim(updated)
                      saveFormData(updated)
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                    style={{ width: 'calc(66.666667% + 25px)' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Appealing">Appealing</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plaintiff</label>
                <input
                  type="text"
                  value={newClaim.plaintiff_name}
                    onChange={(e) => {
                      const updated = { ...newClaim, plaintiff_name: e.target.value }
                      setNewClaim(updated)
                      saveFormData(updated)
                    }}
                  className="w-2/3 border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  style={{ width: 'calc(66.666667% + 25px)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Defendant</label>
                <input
                  type="text"
                  value={newClaim.defendant_name}
                    onChange={(e) => {
                      const updated = { ...newClaim, defendant_name: e.target.value }
                      setNewClaim(updated)
                      saveFormData(updated)
                    }}
                  className="w-2/3 border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  style={{ width: 'calc(66.666667% + 25px)' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pick a Colour</label>
              <div className="flex space-x-2">
                {getClaimColors().map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewClaim({ ...newClaim, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-125 ${
                      newClaim.color === color ? 'border-green-500' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between items-end gap-4">
              <div className="flex-1" style={{ width: 'calc(100% - 140px)' }}>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newClaim.description}
                  onChange={(e) => {
                    const updated = { ...newClaim, description: e.target.value }
                    setNewClaim(updated)
                    saveFormData(updated)
                  }}
                  className="border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  style={{ width: 'calc(100% - 140px)' }}
                  rows={2}
                />
              </div>
              <div className="flex items-end" style={{ marginBottom: '2px' }}>
                <button
                  type="submit"
                  disabled={addClaimMutation.isPending}
                  className="px-3 py-1 rounded-lg disabled:opacity-50"
                  style={{ 
                    backgroundColor: 'rgba(30, 58, 138, 0.3)',
                    border: '2px solid #10b981',
                    color: '#10b981'
                  }}
                >
                  {addClaimMutation.isPending ? 'Adding...' : 'Add Claim'}
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>
      ) : (
        // Main content when form is not open
        <>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {isGuest && (
                <>
                  <button
                    onClick={navigateBack}
                    className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => navigateTo('claims')}
                    className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
                  >
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {!isGuest && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2 hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Claim</span>
                </button>
              )}
            </div>
          </div>
        </>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={editingClaim.status || 'Active'}
                  onChange={(e) => setEditingClaim({ ...editingClaim, status: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                >
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Appealing">Appealing</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div></div>
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
              <label className="block text-sm font-medium mb-1">Pick a Colour</label>
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
                className="px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ 
                  backgroundColor: 'rgba(30, 58, 138, 0.3)',
                  border: '2px solid #10b981',
                  color: '#10b981'
                }}
              >
                {updateClaimMutation.isPending ? 'Updating...' : 'Update Claim'}
              </button>
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="bg-white/10 border border-green-400 text-green-400 px-4 py-2 rounded-lg hover:opacity-90"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* No Claims Message - Only show when there are no claims and no fake card is shown */}
      {!showAddForm && !isLoading && claims && claims.length === 0 && isGuest && (
        <div className="card-enhanced p-8 text-center">
          <div className="text-gold-light">No claims found. Create your first claim to get started!</div>
        </div>
      )}

      {/* Claims Grid */}
      {!showAddForm && claims && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {claims.map((claim, index) => (
          <div
            key={claim.case_number}
            className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow"
            style={{ 
              width: 'calc(100% - 35px)'
            }}
            onClick={() => handleClaimSelect(claim)}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: claim.color || '#3B82F6' }}
                />
                <h3 className="text-lg font-semibold">{claim.title}</h3>
                <span className="text-sm text-gray-600">- {claim.case_number}</span>
              </div>
              <div className="flex items-center space-x-2">
                {!isGuest && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingClaim(claim)
                      }}
                      className="p-1 rounded hover:bg-yellow-100 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-yellow-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteClaimMutation.mutate(claim.case_number)
                      }}
                      className="p-1 rounded hover:bg-red-100 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {claim.court && (
              <p className="text-sm text-gray-600 mb-2">Court: {claim.court}</p>
            )}
            
            <div className="flex justify-between items-center mt-3">
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
        {/* Add New Claim Card - Always at the end */}
        {!isGuest && (
          <div
            className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center text-center"
            onClick={() => setShowAddForm(true)}
            style={{ 
              width: 'calc(80% - 28px)'
            }}
          >
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-gray-300" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Add New Claim</h3>
            </div>
            <div className="flex justify-center mb-2">
              <Plus className="w-12 h-12 text-green-500" />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Click to create a new claim
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  )
}

export default ClaimsTable