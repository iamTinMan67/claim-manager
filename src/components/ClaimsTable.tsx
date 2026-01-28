import React from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Claim } from '@/types/database'
import { Edit, Trash2, Plus, X, Settings, Home, ChevronLeft, Users, Crown, Lock, Share2, FileText } from 'lucide-react'
import { useNavigation } from '@/contexts/NavigationContext'
import EvidenceManager from './EvidenceManager'
import CollaborationHub from './CollaborationHub'
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils'
import { toast } from '@/hooks/use-toast'
import { ShareClaimModal } from './ShareClaimModal'
import { useCollaboration } from '@/hooks/useCollaboration'
import { CommunicationLog } from './CommunicationLog'
import { AlertsSummaryCard } from './AlertsSummaryCard'

interface ClaimsTableProps {
  onClaimSelect: (claimId: string | null) => void
  selectedClaim: string | null
  onClaimColorChange: (color: string) => void
  isGuest?: boolean
  statusFilter?: 'Closed' | null
}

const ClaimsTable = ({ onClaimSelect, selectedClaim, onClaimColorChange, isGuest = false, statusFilter = null }: ClaimsTableProps) => {
  const { navigateBack, navigateTo } = useNavigation()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null)
  const [amendMode, setAmendMode] = useState(false)
  const [newClaim, setNewClaim] = useState({
    case_number: '',
    title: '',
    court: 'NCCBC',
    plaintiff_name: '',
    defendant_name: '',
    contact_number: '',
    email: 'enquiries.northampton.countycourt@justice.gov.uk',
    description: '',
    status: 'Active',
    color: '#3B82F6'
  })
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})
  const [showCollaboration, setShowCollaboration] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCommunicationLog, setShowCommunicationLog] = useState(false)

  const queryClient = useQueryClient()

  // Listen for global connect toggle so the hub can open in selected-claim view
  React.useEffect(() => {
    const onToggle = () => setShowCollaboration(v => !v)
    window.addEventListener('toggleCollaboration', onToggle as EventListener)
    return () => window.removeEventListener('toggleCollaboration', onToggle as EventListener)
  }, [])

  // For private view, determine which of the user's claims are shared (to show Users icon)
  const { data: ownedSharedClaimIds } = useQuery({
    queryKey: ['owned-shared-claim-ids'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return new Set<string>()
      const { data, error } = await supabase
        .from('claim_shares')
        .select('claim_id')
        .eq('owner_id', user.id)
      if (error) return new Set<string>()
      const ids = new Set<string>((data || []).map(r => r.claim_id).filter(Boolean))
      return ids
    }
  })

  // Stop persisting add-claim form data; clear any previous stored values once
  React.useEffect(() => {
    try { localStorage.removeItem('claimFormData') } catch {}
  }, [])

  // Get available (unused) colors for new claims - defined early to avoid hoisting issues
  const getAvailableColors = (claimsData: Claim[] | undefined) => {
    const allColors = getClaimColors()
    if (!claimsData || claimsData.length === 0) {
      return allColors // All colors available if no claims exist
    }
    
    // Get all used colors from existing claims
    const usedColors = new Set(
      claimsData
        .map(claim => claim.color)
        .filter((color): color is string => Boolean(color))
    )
    
    // Filter out used colors
    const availableColors = allColors.filter(color => !usedColors.has(color))
    
    // If all colors are used, return all colors (allow reuse)
    // Otherwise, return only unused colors
    return availableColors.length > 0 ? availableColors : allColors
  }

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

  // Guest freeze status not currently used; default to not frozen
  const guestStatus = null as null

  const { data: claims, isLoading, error } = useQuery({
    queryKey: ['claims', { isGuest, statusFilter }],
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
        // Show user's own claims ONLY - exclude any claims where user is just a guest
        console.log('ClaimsTable: Querying for user claims with user_id:', user.id)
        query = query.eq('user_id', user.id)
      }

      // Apply optional status filter (e.g. Closed claims only)
      if (statusFilter) {
        // When explicitly viewing a status (like Closed Cases), filter by that status
        query = query.eq('status', statusFilter)
      } else {
        // On the main private claims view, hide Closed claims (they live in the Closed Cases page)
        // For guests viewing shared claims, also exclude closed claims
        query = query.neq('status', 'Closed')
      }
      
      console.log('ClaimsTable: Final query:', query)
      const { data, error } = await query
      
      if (error) {
        console.error('Claims query error:', error)
        throw error
      }
      
      // Additional filter: ensure closed claims are never shown in shared/guest view
      // Also exclude claims where user is only a guest (not owner) from private claims view
      let filteredData = data || []
      
      if (!isGuest) {
        // For private claims view, exclude any claims where user is only a guest (not owner)
        // Get claim IDs where user is a guest but NOT the owner
        const { data: guestShares } = await supabase
          .from('claim_shares')
          .select('claim_id, owner_id')
          .eq('shared_with_id', user.id)
        
        const guestOnlyClaimIds = (guestShares || [])
          .filter((share: any) => share.owner_id !== user.id)
          .map((share: any) => share.claim_id)
          .filter(Boolean)
        
        if (guestOnlyClaimIds.length > 0) {
          filteredData = filteredData.filter((claim: Claim) => 
            !guestOnlyClaimIds.includes(claim.claim_id)
          )
        }
      }
      
      if (isGuest && !statusFilter) {
        filteredData = filteredData.filter((claim: Claim) => {
          const status = claim.status?.toString().toLowerCase()
          return status !== 'closed'
        })
      }
      
      console.log('ClaimsTable: Claims data received:', filteredData)
      console.log('ClaimsTable: Query was for isGuest:', isGuest)
      console.log('ClaimsTable: User ID:', user.id)
      return filteredData as Claim[]
    }
  })

  // Ensure selected color is available when opening add form
  React.useEffect(() => {
    if (showAddForm && claims) {
      const availableColors = getAvailableColors(claims)
      // If current color is not available, set to first available color
      if (availableColors.length > 0 && !availableColors.includes(newClaim.color)) {
        setNewClaim(prev => ({ ...prev, color: availableColors[0] }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm, claims])

  // Get claim_id for sharing when a claim is selected (MUST be before any conditional returns)
  const { data: resolvedClaimId, isLoading: isLoadingClaimId } = useQuery({
    queryKey: ['claim-id-for-sharing', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return undefined
      try {
        return await getClaimIdFromCaseNumber(selectedClaim)
      } catch (error) {
        console.error('Error resolving claim ID for sharing:', error)
        return undefined
      }
    },
    enabled: !!selectedClaim && !isGuest
  })

  // Use collaboration hook for sharing (MUST be before any conditional returns)
  // Hook handles undefined claimId gracefully by checking before making queries
  const {
    shareClaimWithUser = async () => ({ success: false }),
    searchUsers: searchUsersForSharing = async () => []
  } = useCollaboration(resolvedClaimId || undefined)

  // Fetch claim directly if selected but not in claims list (MUST be before any conditional returns)
  const claimInList = selectedClaim ? claims?.find(c => c.case_number === selectedClaim) : null
  const needsDirectFetch = !!selectedClaim && !claimInList && !isLoading
  
  const { data: directClaim, isLoading: loadingDirectClaim, error: directClaimError } = useQuery({
    queryKey: ['direct-claim', selectedClaim, isGuest],
    queryFn: async () => {
      if (!selectedClaim) return null
      
      console.log('Direct claim query - fetching for:', { selectedClaim, isGuest })
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('Direct claim query - no user')
        return null
      }
      
      // For guests, verify they have access via claim_shares
      if (isGuest) {
        // First get the claim_id from case_number
        const claimId = await getClaimIdFromCaseNumber(selectedClaim)
        console.log('Direct claim query - claimId:', claimId)
        if (!claimId) return null
        
        // Verify the user has access via claim_shares
        const { data: share, error: shareError } = await supabase
          .from('claim_shares')
          .select('claim_id')
          .eq('claim_id', claimId)
          .eq('shared_with_id', user.id)
          .maybeSingle()
        
        console.log('Direct claim query - share check:', { share, shareError })
        if (!share) {
          console.log('Direct claim query - no share found, user does not have access')
          return null // No access
        }
      }
      
      // Fetch the claim by case_number
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('case_number', selectedClaim)
        .maybeSingle()
      
      if (error) {
        console.error('Error fetching direct claim:', error)
        return null
      }
      
      if (!data) {
        console.log('Direct claim query - no data returned')
        return null
      }
      
      console.log('Direct claim fetched successfully:', data)
      return data as Claim
    },
    enabled: needsDirectFetch,
    retry: 1
  })
  
  if (directClaimError) {
    console.error('Direct claim query error:', directClaimError)
  }
  
  // Use claim from list if available, otherwise use direct claim
  const claim = claimInList || directClaim || null

  // Debug logging (MUST be before any conditional returns)
  React.useEffect(() => {
    if (selectedClaim) {
      console.log('ClaimsTable - Selected claim state:', {
        selectedClaim,
        claimInList: !!claimInList,
        directClaim: !!directClaim,
        claim: !!claim,
        claimData: claim,
        isGuest,
        loadingDirectClaim
      })
    }
  }, [selectedClaim, claimInList, directClaim, claim, isGuest, loadingDirectClaim])

  const addClaimMutation = useMutation({
    mutationFn: async (claimData: typeof newClaim) => {
      // Get user and verify session
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Auth error:', authError)
        throw new Error('Not authenticated. Please refresh your session.')
      }

      // Verify session is still valid
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Session expired. Please log in again.')
      }

      console.log('Creating claim with user_id:', user.id)

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

      // Prepare insert data with all required fields
      const insertData = {
        case_number: claimData.case_number.trim(),
        title: claimData.title.trim(),
        court: claimData.court?.trim() || null,
        plaintiff_name: claimData.plaintiff_name?.trim() || null,
        defendant_name: claimData.defendant_name?.trim() || null,
        contact_number: claimData.contact_number?.trim() || null,
        email: claimData.email?.trim() || null,
        description: claimData.description?.trim() || null,
        status: claimData.status || 'Active',
        color: claimData.color || '#3B82F6',
        user_id: user.id
      }

      console.log('Inserting claim data:', { ...insertData, user_id: user.id })

      const { data, error } = await supabase
        .from('claims')
        .insert([insertData])
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // Provide more helpful error message
        if (error.code === '42501') {
          throw new Error('Permission denied. Please ensure you are logged in and have permission to create claims. If the issue persists, please contact support.')
        }
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
        court: 'NCCBC',
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
    mutationFn: async ({ claim_id, data }: { claim_id: string, data: Partial<Claim> }) => {
      // Filter out read-only fields that shouldn't be updated
      const { user_id, created_at, updated_at, ...updateData } = data as any
      
      // Convert empty strings to null
      if (updateData.email === '') {
        updateData.email = null
      }
      if (updateData.contact_number === '') {
        updateData.contact_number = null
      }
      
      // Check if case_number is being changed and if it already exists
      if (updateData.case_number && updateData.case_number.trim()) {
        const { data: existingClaim, error: checkError } = await supabase
          .from('claims')
          .select('claim_id, case_number')
          .eq('case_number', updateData.case_number.trim())
          .neq('claim_id', claim_id)
          .maybeSingle()
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking case number uniqueness:', checkError)
        } else if (existingClaim) {
          throw new Error('Case number already exists. Please choose a different case number.')
        }
      }
      
      console.log('Updating claim with data:', updateData)
      
      const { data: result, error } = await supabase
        .from('claims')
        .update(updateData)
        .eq('claim_id', claim_id)
        .select()
        .single()

      if (error) {
        console.error('Error updating claim:', error)
        // Provide helpful error message if email column doesn't exist
        if (error.message && error.message.includes('email') && error.code === 'PGRST204') {
          throw new Error('The "email" column does not exist in the "claims" table. Please add it to your Supabase database schema using: ALTER TABLE claims ADD COLUMN email TEXT;')
        }
        throw error
      }
      
      console.log('Claim updated successfully:', result)
      return result
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      // Always invalidate shared-claims when a claim is updated
      // This ensures closed claims are immediately removed from shared view
      // when a private claim's status is changed to "Closed"
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      // If the case number was changed, keep the UI focused on the updated claim
      if (data?.case_number) {
        onClaimSelect(data.case_number)
      }
      setEditingClaim(null)
      toast({
        title: "Success",
        description: "Claim updated successfully!",
      })
    },
    onError: (error: any) => {
      console.error('Claim update error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update claim. Please try again.",
        variant: "destructive"
      })
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
    
    // Prepare claim data with all fields
    const claimData = {
      ...newClaim,
      description: newClaim.description || ''
    }
    
    addClaimMutation.mutate(claimData)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClaim || !editingClaim.claim_id) return
    
    // Validate case number
    if (!editingClaim.case_number || !editingClaim.case_number.trim()) {
      toast({
        title: "Error",
        description: "Case Number is required",
        variant: "destructive",
      })
      return
    }
    
    updateClaimMutation.mutate({
      claim_id: editingClaim.claim_id,
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

  // If a claim is selected, show only that claim with evidence subform (and optional Connect Hub)
  if (selectedClaim) {
    if (loadingDirectClaim && !claim) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-600">Loading claim details...</div>
        </div>
      )
    }
    
    if (!claim) {
      return (
        <div className="card-enhanced p-4 border-red-400/50">
          <div className="text-red-200">Claim not found or you do not have access to this claim.</div>
          <div className="text-gray-400 text-sm mt-2">
            Selected: {selectedClaim} | isGuest: {isGuest ? 'true' : 'false'} | In list: {claimInList ? 'yes' : 'no'} | Direct: {directClaim ? 'yes' : 'no'} | Loading: {loadingDirectClaim ? 'yes' : 'no'}
          </div>
        </div>
      )
    }
    
    // Ensure claim has required fields
    if (!claim.case_number || !claim.claim_id) {
      console.error('Claim missing required fields:', claim)
      return (
        <div className="card-enhanced p-4 border-red-400/50">
          <div className="text-red-200">Claim data is incomplete. Missing case_number or claim_id.</div>
          <div className="text-gray-400 text-sm mt-2">
            Claim data: {JSON.stringify(claim, null, 2)}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {showCollaboration && (
          <div className="card-enhanced rounded-lg shadow border-l-4 relative z-30 w-full" style={{ borderLeftColor: claim.color || '#3B82F6' }}>
            <div className="p-0 h-[calc(100vh-2rem)]">
              <div className="h-full overflow-hidden">
                <CollaborationHub 
                  selectedClaim={selectedClaim}
                  claimColor={claim.color || '#3B82F6'}
                  currentUserId={currentUser?.id}
                  isGuest={isGuest}
                />
              </div>
            </div>
          </div>
        )}
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
                  // If viewing a shared claim (guest context), go back to shared list; otherwise go to private claims
                  const targetTab = isGuest ? 'shared' : 'claims'
                  window.dispatchEvent(new CustomEvent('tabChange', { detail: targetTab }))
                  sessionStorage.setItem('welcome_seen_session', '1')
                } catch {}
                navigateTo(isGuest ? 'shared' : 'claims')
              }}
              className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            {isGuest && (
              <button
                onClick={() => { 
                  try { 
                    sessionStorage.setItem('welcome_seen_session', '1')
                    window.dispatchEvent(new CustomEvent('claimSelected', { detail: { claimId: null } }))
                  } catch {}
                  navigateTo('claims') 
                }}
                className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gold text-center flex-1">Claim Details</h2>
          <div className="flex items-center space-x-2">
            {!isGuest && (
              <>
                <button
                  onClick={() => {
                    if (resolvedClaimId) {
                      setShowCommunicationLog(true)
                    } else {
                      toast({
                        title: "Please wait",
                        description: "Loading claim information. Please try again in a moment.",
                        variant: "default"
                      })
                    }
                  }}
                  disabled={!resolvedClaimId}
                  className="bg-white/10 border border-blue-400 text-blue-400 px-3 py-1 rounded-lg flex items-center space-x-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={resolvedClaimId ? "View communication log for this claim" : "Loading claim information..."}
                >
                  <FileText className="w-4 h-4" />
                  <span>Log</span>
                </button>
                <button
                  onClick={() => {
                    if (resolvedClaimId) {
                      setShowShareModal(true)
                    } else {
                      toast({
                        title: "Please wait",
                        description: "Loading claim information. Please try again in a moment.",
                        variant: "default"
                      })
                    }
                  }}
                  disabled={!resolvedClaimId}
                  className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={resolvedClaimId ? "Share this claim with others" : "Loading claim information..."}
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Evidence */}
        {claim && claim.case_number ? (
          <EvidenceManager 
            selectedClaim={selectedClaim} 
            claimColor={claim.color || '#3B82F6'} 
            amendMode={amendMode}
            isGuest={isGuest}
            currentUserId={currentUser?.id}
            isGuestFrozen={false}
            onEditClaim={() => setEditingClaim(claim)}
            onDeleteClaim={() => deleteClaimMutation.mutate(claim.case_number)}
            onSetAmendMode={setAmendMode}
          />
        ) : (
          <div className="card-enhanced p-4 border-yellow-400/50">
            <div className="text-yellow-200">Claim data is incomplete. Missing case_number.</div>
            <div className="text-gray-400 text-sm mt-2">
              Claim object: {JSON.stringify(claim, null, 2)}
            </div>
          </div>
        )}

        {/* Share Claim Modal */}
        {!isGuest && resolvedClaimId && (
          <>
            <ShareClaimModal
              open={showShareModal}
              onOpenChange={setShowShareModal}
              onShare={async (email, permissions) => {
                if (!resolvedClaimId) return false
                const result = await shareClaimWithUser(email, permissions)
                return result?.success || false
              }}
              onSearchUsers={async (query) => {
                return await searchUsersForSharing(query)
              }}
            />
            <CommunicationLog
              open={showCommunicationLog}
              onOpenChange={setShowCommunicationLog}
              claimId={resolvedClaimId}
              claimTitle={claim?.title || null}
            />
          </>
        )}
      </div>
    )
  }

  // Show all claims in boxes
  return (
    <div className="space-y-6">
      {showAddForm && !isGuest && !statusFilter ? (
        // Form overlay - hide main content
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card-enhanced p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gold">Add New Claim</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-red-400 hover:text-red-500 hover:bg-red-400/10 rounded-full p-1 transition-colors border border-red-400"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-4">
              
              {/* Row 1: Title, Court, Case Number */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Claim Title *</label>
                  <input
                    type="text"
                    value={newClaim.title}
                    onChange={(e) => {
                      const updated = { ...newClaim, title: e.target.value }
                      setNewClaim(updated)
                      clearError('title')
                    }}
                    className={`w-full border rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:ring-2 ${
                      formErrors.title 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                        : 'border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400/20'
                    }`}
                    placeholder="e.g., Property Damage Claim"
                    required
                  />
                  {formErrors.title && (
                    <p className="text-red-400 text-sm mt-1">{formErrors.title}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Court</label>
                  <input
                    type="text"
                    value={newClaim.court}
                    onChange={(e) => {
                      const updated = { ...newClaim, court: e.target.value }
                      setNewClaim(updated)
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  />
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
                    }}
                    className={`w-full border rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:ring-2 ${
                      formErrors.case_number 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                        : 'border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400/20'
                    }`}
                    placeholder="e.g., CV-2024-001"
                    required
                  />
                  {formErrors.case_number && (
                    <p className="text-red-400 text-sm mt-1">{formErrors.case_number}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Status, Plaintiff, Defendant */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={newClaim.status}
                    onChange={(e) => {
                      const updated = { ...newClaim, status: e.target.value }
                      setNewClaim(updated)
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Appealing">Appealing</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Plaintiff</label>
                  <input
                    type="text"
                    value={newClaim.plaintiff_name}
                    onChange={(e) => {
                      const updated = { ...newClaim, plaintiff_name: e.target.value }
                      setNewClaim(updated)
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
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
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  />
                </div>
              </div>

              {/* Row 3: Contact Number and Email */}
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Number</label>
                  <input
                    type="tel"
                    value={newClaim.contact_number}
                    onChange={(e) => {
                      const updated = { ...newClaim, contact_number: e.target.value }
                      setNewClaim(updated)
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                    placeholder="e.g., 01234 567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={newClaim.email}
                    onChange={(e) => {
                      const updated = { ...newClaim, email: e.target.value }
                      setNewClaim(updated)
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                    placeholder="e.g., contact@example.com"
                    required={false}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addClaimMutation.isPending}
                    className="px-4 py-2 rounded-lg disabled:opacity-50"
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
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pick a Colour</label>
              <div className="flex space-x-2">
                {getAvailableColors(claims || []).map(color => (
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
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newClaim.description}
                onChange={(e) => {
                  const updated = { ...newClaim, description: e.target.value }
                  setNewClaim(updated)
                }}
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                rows={3}
              />
            </div>
          </form>
          </div>
        </div>
      ) : (
        // Main content when form is not open
        <>
          <div className="flex justify-between items-center sticky top-0 z-40 backdrop-blur-md py-2 -mx-4 px-4 mb-4" style={{ backgroundColor: 'rgba(30, 27, 75, 0.3)' }}>
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
                    onClick={() => { 
                      try { 
                        window.dispatchEvent(new CustomEvent('claimSelected', { detail: { claimId: null } }))
                        sessionStorage.setItem('welcome_seen_session', '1') 
                      } catch {}
                      navigateTo('claims')
                    }}
                    className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
                  >
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2" />
          </div>
        </>
      )}

      {editingClaim && !isGuest && (
        <div className="card-enhanced p-6">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gold">Edit Claim</h3>
            <button
              type="button"
              onClick={() => setEditingClaim(null)}
              className="text-red-400 hover:text-red-500 hover:bg-red-400/10 rounded-full p-1 transition-colors border border-red-400"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleUpdate} className="space-y-4" noValidate>
            {/* Row 1: Title, Court, Case Number */}
            <div className="grid grid-cols-3 gap-4">
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
                <label className="block text-sm font-medium mb-1">Case Number *</label>
                <input
                  type="text"
                  value={editingClaim.case_number}
                  onChange={(e) => setEditingClaim({ ...editingClaim, case_number: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  required
                />
              </div>
            </div>
            {/* Row 2: Status, Plaintiff, Defendant */}
            <div className="grid grid-cols-3 gap-4">
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
            {/* Row 3: Contact Number, Email, and Update Claim button */}
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Contact Number</label>
                <input
                  type="tel"
                  value={editingClaim.contact_number || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, contact_number: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  placeholder="e.g., 01234 567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editingClaim.email || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, email: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  placeholder="e.g., contact@example.com"
                />
              </div>
              <div className="flex justify-end">
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
              </div>
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
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editingClaim.description || ''}
                onChange={(e) => setEditingClaim({ ...editingClaim, description: e.target.value })}
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                rows={3}
              />
            </div>
          </form>
        </div>
      )}

      {/* No Claims Message - Show tailored banner for private vs shared */}
      {!showAddForm && !isLoading && claims && claims.length === 0 && (
        <div className="card-enhanced p-8 text-center">
          <div className="text-gold-light">
            {isGuest
              ? 'No shared claims yet. Ask a host to share one with you.'
              : statusFilter === 'Closed'
                ? 'No closed private claims yet.'
                : 'No private claims yet. Create a new claim.'}
          </div>
        </div>
      )}

      {/* Claims Grid */}
      {!showAddForm && claims && (
        <>
          {!selectedClaim && !statusFilter && (
            <AlertsSummaryCard scope={isGuest ? 'shared' : 'private'} />
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {claims.map((claim, index) => (
          <div
            key={claim.case_number}
            className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow max-w-xl"
            onClick={() => handleClaimSelect(claim)}
          >
            {/* Header row: title + icons */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-2 min-w-0">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: claim.color || '#3B82F6' }}
                />
                <h3 className="text-lg font-semibold truncate">{claim.title}</h3>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* Sharing status icon: Users if shared, Crown if private */}
                {!isGuest ? (
                  (ownedSharedClaimIds && claim.claim_id && ownedSharedClaimIds.has(claim.claim_id)) ? (
                    <Users className="w-4 h-4 text-green-500" aria-label="Shared" />
                  ) : (
                    <Crown className="w-4 h-4 text-yellow-500" aria-label="Private" />
                  )
                ) : (
                  <Users className="w-4 h-4 text-green-500" aria-label="Shared with you" />
                )}
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

            {/* Row 2: Court (left) + Defendant (right, aligned with card edge) */}
            <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
              <p className="text-xs text-gray-600 truncate">
                {claim.court || 'Unknown Court'}
              </p>
              {claim.defendant_name && (
                <p className="text-xs text-gray-600 text-right truncate">
                  Defendant: {claim.defendant_name}
                </p>
              )}
            </div>
            {/* Row 3: Case Number (left) + Plaintiff (right, aligned with Defendant/date) */}
            <div className="flex items-baseline justify-between gap-2 mt-1 whitespace-nowrap">
              <p className="text-xs text-gray-600 truncate">
                Case: {claim.case_number}
              </p>
              {claim.plaintiff_name && (
                <p className="text-xs text-gray-600 text-right truncate">
                  Plaintiff: {claim.plaintiff_name}
                </p>
              )}
            </div>
            
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
        {/* Closed Cases navigation card - only on main private claims view */}
        {!isGuest && !statusFilter && (
          <div
            key="closed-cases-card"
            className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow max-w-xl flex flex-col items-center justify-center text-center"
            style={{ minWidth: '200px', width: '100%', display: 'block' }}
            onClick={() => {
              try { sessionStorage.setItem('welcome_seen_session', '1') } catch {}
              navigateTo('closed-claims')
            }}
          >
            {/* Top row: red dot + title, matching Add New Claim heading style */}
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Closed Cases</h3>
            </div>
            {/* Middle row: lock icon, mirroring the icon emphasis row of Add New Claim */}
            <div className="flex justify-center mb-2">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            {/* Bottom row: description text, same font sizing as Add New Claim description */}
            <div className="text-sm text-gray-500 dark:text-gray-500">
              View Closed Claims.
            </div>
          </div>
        )}
        {/* Add New Claim Card - Always at the end (hide on closed view and for guests) */}
        {!isGuest && !statusFilter && (
          <div
            className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow max-w-xl border-l-4 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center text-center"
            onClick={() => setShowAddForm(true)}
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
        </>
      )}
    </div>
  )
}

export default ClaimsTable