import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Evidence } from '@/types/database'
import { Plus, Edit, Trash2, Upload, Download, Eye, X, Save, Settings, FileText, Calendar, Hash, GripVertical, Link } from 'lucide-react'
import PendingEvidenceReview from './PendingEvidenceReview'
import { AddEvidenceModal } from './AddEvidenceModal'
import { LinkEvidenceModal } from './LinkEvidenceModal'
import { toast } from '@/hooks/use-toast'
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils'

interface EvidenceManagerProps {
  selectedClaim: string | null
  claimColor?: string
  amendMode?: boolean
  isGuest?: boolean
  guestCanEdit?: boolean
  currentUserId?: string
  isGuestFrozen?: boolean
  onEditClaim?: () => void
  onDeleteClaim?: () => void
  onSetAmendMode?: (mode: boolean) => void
  isStatic?: boolean
  hidePendingReview?: boolean
}

const EvidenceManager = ({ 
  selectedClaim, 
  claimColor = '#3B82F6', 
  amendMode = false,
  isGuest = false,
  guestCanEdit = false,
  currentUserId,
  isGuestFrozen = false,
  onEditClaim,
  onDeleteClaim,
  onSetAmendMode,
  isStatic = false,
  hidePendingReview = false
}: EvidenceManagerProps) => {
  const isInteractive = !isStatic && (!isGuest || !isGuestFrozen)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [availableEvidence, setAvailableEvidence] = useState<Evidence[]>([])
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [linkPermissions, setLinkPermissions] = useState<Record<string, boolean>>({})
  const [filterText, setFilterText] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [columnPrefs, setColumnPrefs] = useState<{ showMethod: boolean; showPages: boolean; showExhibit: boolean }>(() => {
    try {
      const raw = localStorage.getItem('evidence_column_prefs')
      if (raw) return JSON.parse(raw)
    } catch {}
    return { showMethod: true, showPages: true, showExhibit: true }
  })
  const [autoApproveTrusted, setAutoApproveTrusted] = useState<boolean>(false)

  // Persist collapsed state per-claim (by case_number)
  useEffect(() => {
    try {
      if (!selectedClaim) return
      const stored = localStorage.getItem(`evidence_collapsed_${selectedClaim}`)
      if (stored === '0') setIsCollapsed(false)
      if (stored === '1') setIsCollapsed(true)
    } catch {}
  }, [selectedClaim])

  // No auto-expand or auto-open modal; user will click Show or Add each time

  useEffect(() => {
    try {
      if (!selectedClaim) return
      localStorage.setItem(`evidence_collapsed_${selectedClaim}` , isCollapsed ? '1' : '0')
    } catch {}
  }, [isCollapsed, selectedClaim])

  const queryClient = useQueryClient()

  // Guest download permission based on claim_shares.allow_guest_downloads
  const { data: guestDownloadAllowed } = useQuery({
    queryKey: ['share-downloads', selectedClaim, isGuest],
    enabled: Boolean(selectedClaim) && Boolean(isGuest),
    queryFn: async () => {
      try {
        if (!isGuest || !selectedClaim) return true
        const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        let claimId: string | null = null
        if (uuidPattern.test(selectedClaim)) {
          claimId = selectedClaim
        } else {
          claimId = await getClaimIdFromCaseNumber(selectedClaim)
        }
        if (!claimId) return true
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return true
        const { data: share } = await supabase
          .from('claim_shares')
          .select('allow_guest_downloads')
          .eq('claim_id', claimId)
          .eq('shared_with_id', user.id)
          .maybeSingle()
        return (share?.allow_guest_downloads ?? true) as boolean
      } catch {
        return true
      }
    }
  })

  // Clear any selections when leaving amend mode
  useEffect(() => {
    if (!amendMode) {
      setSelectedIds({})
    }
  }, [amendMode])

  // Host-side control: toggle allow_guest_downloads for this claim across all shares
  const { data: hostGuestDownloadAllowed } = useQuery({
    queryKey: ['share-downloads-host', selectedClaim, isGuest],
    enabled: Boolean(selectedClaim) && !isGuest,
    queryFn: async () => {
      try {
        if (isGuest || !selectedClaim) return true
        const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        let claimId: string | null = null
        if (uuidPattern.test(selectedClaim)) {
          claimId = selectedClaim
        } else {
          claimId = await getClaimIdFromCaseNumber(selectedClaim)
        }
        if (!claimId) return true
        const { data } = await supabase
          .from('claim_shares')
          .select('allow_guest_downloads')
          .eq('claim_id', claimId)
          .limit(1)
          .maybeSingle()
        return (data?.allow_guest_downloads ?? true) as boolean
      } catch {
        return true
      }
    }
  })

  const toggleGuestDownloads = async (next: boolean) => {
    try {
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      let claimId: string | null = null
      if (selectedClaim) {
        claimId = uuidPattern.test(selectedClaim) ? selectedClaim : await getClaimIdFromCaseNumber(selectedClaim)
      }
      if (!claimId) return
      const { error } = await supabase
        .from('claim_shares')
        .update({ allow_guest_downloads: next })
        .eq('claim_id', claimId)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['share-downloads-host', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['share-downloads', selectedClaim] })
    } catch (e) {
      console.warn('Failed to toggle allow_guest_downloads', e)
    }
  }

  // Determine if current user is the owner of the selected claim
  const { data: isOwner } = useQuery({
    queryKey: ['claim-owner', selectedClaim],
    enabled: Boolean(selectedClaim),
    queryFn: async () => {
      try {
        if (!selectedClaim) return false
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return false
        const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        let claimId: string | null = null
        if (uuidPattern.test(selectedClaim)) {
          claimId = selectedClaim
        } else {
          claimId = await getClaimIdFromCaseNumber(selectedClaim)
        }
        if (!claimId) return false
        const { data: claim } = await supabase
          .from('claims')
          .select('user_id')
          .eq('claim_id', claimId)
          .maybeSingle()
        return claim?.user_id === user.id
      } catch {
        return false
      }
    }
  })

  // One-time cleanup: delete evidence rows without a case_number (user directive)
  useEffect(() => {
    const runCleanup = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        // Delete only current user's rogue rows to satisfy RLS
        // 1) case_number IS NULL
        await supabase
          .from('evidence')
          .delete()
          .is('case_number', null)
          .eq('user_id', user.id)
        // 2) case_number = ''
        await supabase
          .from('evidence')
          .delete()
          .eq('case_number', '')
          .eq('user_id', user.id)
      } catch (err) {
        // Silent fail to avoid blocking UI
        console.warn('Evidence cleanup skipped:', err)
      }
    }
    runCleanup()
  }, [])

  // Get evidence data from evidence table (support both legacy case_number and new evidence_claims link)
  const { data: evidenceData, isLoading, error } = useQuery({
    queryKey: ['evidence', selectedClaim],
    queryFn: async () => {
      console.log('EvidenceManager: Loading evidence for selectedClaim:', selectedClaim)
      
      // If no claim selected, load all for user ordering purposes
      if (!selectedClaim) {
        console.log('EvidenceManager: No claim selected, loading all evidence')
        const { data, error } = await supabase
        .from('evidence')
        .select('*')
        .order('display_order', { ascending: false, nullsFirst: true })
          .order('created_at', { ascending: false })
      if (error) throw error
      console.log('EvidenceManager: Loaded all evidence:', data?.length || 0, 'items')
      return data as Evidence[]
    }

      // Determine claim_id from either case_number or direct UUID
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      let claimId: string | null = null
      if (uuidPattern.test(selectedClaim)) {
        console.log('EvidenceManager: selectedClaim appears to be a claim_id (UUID):', selectedClaim)
        claimId = selectedClaim
      } else {
        console.log('EvidenceManager: Getting claim_id for case_number:', selectedClaim)
        claimId = await getClaimIdFromCaseNumber(selectedClaim)
        if (!claimId) {
          // Fallback: try session-stashed UUID from SharedClaims click
          try {
            const stashed = sessionStorage.getItem('selected_claim_uuid')
            if (stashed && uuidPattern.test(stashed)) {
              console.log('EvidenceManager: Using stashed claim UUID from sessionStorage:', stashed)
              claimId = stashed
            }
          } catch {}
        }
      }
      
      if (!claimId) {
        console.error('EvidenceManager: Could not find claim_id for case_number:', selectedClaim)
        // If we can't find the claim, just return empty array
        return []
      }
      
      console.log('EvidenceManager: Found claim_id:', claimId)

      // Fetch linked evidence ids via evidence_claims for the selected claim
      const { data: linkRows, error: linkErr } = await supabase
        .from('evidence_claims')
        .select('evidence_id')
        .eq('claim_id', claimId)
      if (linkErr) throw linkErr
      const linkedIds = (linkRows || []).map(r => r.evidence_id).filter(Boolean)

      // Fetch evidence by linked ids
      const byLinkPromise = linkedIds.length
        ? supabase.from('evidence').select('*').in('id', linkedIds)
        : Promise.resolve({ data: [] as any[], error: null } as any)

      // Legacy fallback: if no links found, try loading by case_number and owner
      let byLegacyPromise: Promise<any> = Promise.resolve({ data: [] as any[], error: null } as any)
      if (!linkedIds.length && selectedClaim) {
        try {
          console.log('EvidenceManager: No linked evidence found, attempting legacy case_number fallback for', selectedClaim)
          // Find claim owner to limit scope
          const { data: claimOwner } = await supabase
            .from('claims')
            .select('user_id')
            .eq('claim_id', claimId)
            .maybeSingle()
          const ownerId = claimOwner?.user_id
          // Build legacy query
          let legacyQuery = supabase
            .from('evidence')
            .select('*')
            .eq('case_number', selectedClaim)
          if (ownerId) {
            legacyQuery = legacyQuery.eq('user_id', ownerId)
          }
          byLegacyPromise = legacyQuery
        } catch (e) {
          console.warn('EvidenceManager: Legacy fallback setup failed:', e)
        }
      }

      const [byLink, byLegacy] = await Promise.all([byLinkPromise, byLegacyPromise])
      if (byLink.error) throw byLink.error
      if (byLegacy.error) throw byLegacy.error

      console.log('EvidenceManager: byLink data:', byLink.data?.length || 0, 'items')
      console.log('EvidenceManager: byLegacy data:', byLegacy.data?.length || 0, 'items')

      // Merge and de-duplicate by id, then normalize fields to reduce "mess"
      const mergedMap = new Map<string, Evidence>()
      ;[...(byLink.data || []), ...(byLegacy.data || [])].forEach((raw: any) => {
        if (!raw || !raw.id) return
        console.log('EvidenceManager: Processing raw evidence:', {
          id: raw.id,
          file_name: raw.file_name,
          title: raw.title
        })
        // Normalize
        const cleaned: Evidence = {
          ...raw,
          file_name: typeof raw.file_name === 'string' ? raw.file_name.trim() : raw.file_name,
          file_url: typeof raw.file_url === 'string' ? raw.file_url.trim() : raw.file_url,
          method: typeof raw.method === 'string' ? raw.method.trim() : raw.method,
          url_link: typeof raw.url_link === 'string' ? raw.url_link.trim() : raw.url_link,
          book_of_deeds_ref: typeof raw.book_of_deeds_ref === 'string' ? raw.book_of_deeds_ref.trim() : raw.book_of_deeds_ref,
          date_submitted: raw.date_submitted === '' ? null : raw.date_submitted,
          number_of_pages: raw.number_of_pages != null && !isNaN(Number(raw.number_of_pages)) ? Number(raw.number_of_pages) : null,
        }

        // Set exhibit_number based on display_order if not already set
        if ((cleaned as any).exhibit_number == null) {
          (cleaned as any).exhibit_number = cleaned.display_order || 1
        }

        mergedMap.set(cleaned.id as any, cleaned)
      })
      let merged = Array.from(mergedMap.values())

      // Debug: Log evidence before filtering
      console.log('EvidenceManager: Before filtering:', merged.length, 'items')
      merged.forEach((e, i) => {
        console.log(`Evidence ${i}:`, {
          id: e.id,
          file_name: e.file_name,
          file_url: e.file_url,
          title: e.title,
          has_file_name: !!(e.file_name && e.file_name.length),
          has_file_url: !!(e.file_url && e.file_url.length)
        })
      })
      
      console.log('EvidenceManager: After merge (no filtering):', merged.length, 'items')

      // No need to filter by case_number since evidence is already linked via evidence_claims table

      // Sort: first by display_order desc (nulls last), then created_at desc
      merged.sort((a, b) => {
        const ao = a.display_order ?? -Infinity
        const bo = b.display_order ?? -Infinity
        if (ao !== bo) return bo - ao
        const at = new Date(a.created_at).getTime()
        const bt = new Date(b.created_at).getTime()
        return bt - at
      })

      console.log('EvidenceManager: Final merged evidence result:', merged.length, 'items')
      console.log('EvidenceManager: Evidence items:', merged)
      return merged
    }
  })

  // Derived: filtered evidence based on search and method
  const filteredEvidence = React.useMemo(() => {
    let list = evidenceData || []
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      list = list.filter((e) => {
        const title = (e.title || e.file_name || e.name || '').toString().toLowerCase()
        const method = (e.method || '').toString().toLowerCase()
        return title.includes(q) || method.includes(q)
      })
    }
    if (methodFilter) {
      const mf = methodFilter.toLowerCase()
      list = list.filter((e) => ((e.method || '') as any)
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') === mf)
    }
    if (tagFilter) {
      // Simple client-side tags using localStorage mapping evidenceId -> tag
      try {
        const raw = localStorage.getItem('evidence_tags')
        const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
        list = list.filter((e) => (map[e.id as any] || '') === tagFilter)
      } catch {}
    }
    return list
  }, [evidenceData, filterText, methodFilter])

  useEffect(() => {
    try { localStorage.setItem('evidence_column_prefs', JSON.stringify(columnPrefs)) } catch {}
  }, [columnPrefs])

  // Try to load auto-approve flag from DB; fallback to localStorage
  useEffect(() => {
    const loadAutoApprove = async () => {
      try {
        if (!selectedClaim || isGuest) return
        const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        const claimId = uuidPattern.test(selectedClaim) ? selectedClaim : await getClaimIdFromCaseNumber(selectedClaim)
        if (!claimId) return
        const { data } = await supabase
          .from('claim_shares')
          .select('auto_approve_trusted')
          .eq('claim_id', claimId)
          .limit(1)
          .maybeSingle()
        if (data && typeof (data as any).auto_approve_trusted === 'boolean') {
          setAutoApproveTrusted((data as any).auto_approve_trusted)
          return
        }
      } catch {}
      try {
        const raw = localStorage.getItem(`auto_approve_trusted_${selectedClaim}`)
        if (raw != null) setAutoApproveTrusted(raw === '1')
      } catch {}
    }
    loadAutoApprove()
  }, [selectedClaim, isGuest])

  const saveAutoApproveTrusted = async (next: boolean) => {
    setAutoApproveTrusted(next)
    try {
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      const claimId = selectedClaim ? (uuidPattern.test(selectedClaim) ? selectedClaim : await getClaimIdFromCaseNumber(selectedClaim)) : null
      if (claimId) {
        await supabase
          .from('claim_shares')
          .update({ auto_approve_trusted: next })
          .eq('claim_id', claimId)
      }
    } catch (e) {
      console.warn('Auto-approve trusted not persisted to DB; falling back to localStorage', e)
    }
    try { localStorage.setItem(`auto_approve_trusted_${selectedClaim}`, next ? '1' : '0') } catch {}
  }

  // Load per-item guest download permission from evidence_claims for current claim
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        if (!selectedClaim) return
        const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        let claimId: string | null = null
        if (uuidPattern.test(selectedClaim)) {
          claimId = selectedClaim
        } else {
          claimId = await getClaimIdFromCaseNumber(selectedClaim)
        }
        if (!claimId) return
        const { data, error } = await supabase
          .from('evidence_claims')
          .select('evidence_id, guest_download_allowed')
          .eq('claim_id', claimId)
        if (error) return
        const map: Record<string, boolean> = {}
        ;(data || []).forEach((r: any) => {
          if (r.evidence_id) map[r.evidence_id] = r.guest_download_allowed !== false
        })
        setLinkPermissions(map)
      } catch {}
    }
    loadPermissions()
  }, [selectedClaim])

  const runAccessDiagnostics = async () => {
    try {
      setDiagnosticsRunning(true)
      console.log('Diagnostics: starting...')
      console.log('Diagnostics: props', { selectedClaim, isGuest, currentUserId })

      const { data: authInfo } = await supabase.auth.getUser()
      const authUser = authInfo?.user
      console.log('Diagnostics: auth user', authUser?.id)

      if (!selectedClaim) {
        console.warn('Diagnostics: No selectedClaim; aborting')
        return
      }

      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      let claimId: string | null = null
      if (uuidPattern.test(selectedClaim)) {
        claimId = selectedClaim
      } else {
        claimId = await getClaimIdFromCaseNumber(selectedClaim)
      }

      if (!claimId) {
        console.error('Diagnostics: could not resolve claimId for', selectedClaim)
        return
      }
      console.log('Diagnostics: resolved claimId', claimId)

      // Check claim shares for this user
      try {
        const { data: shares, error: shareErr } = await supabase
          .from('claim_shares')
          .select('*')
          .eq('claim_id', claimId)
        if (shareErr) {
          console.warn('Diagnostics: claim_shares error', shareErr)
        } else {
          console.log('Diagnostics: claim_shares rows', shares?.length || 0)
          console.log('Diagnostics: claim_shares sample', shares?.slice(0, 3))
          if (authUser) {
            const relevant = (shares || []).filter(s => s.shared_with_id === authUser.id || s.owner_id === authUser.id)
            console.log('Diagnostics: claim_shares relevant to current user', relevant)
          }
        }
      } catch (e) {
        console.warn('Diagnostics: claim_shares check failed', e)
      }

      // Fetch evidence_claims rows
      const { data: linkRows, error: linkErr } = await supabase
        .from('evidence_claims')
        .select('*')
        .eq('claim_id', claimId)
      if (linkErr) {
        console.error('Diagnostics: evidence_claims error', linkErr)
        return
      }
      console.log('Diagnostics: evidence_claims count', linkRows?.length || 0)
      const linkedIds = (linkRows || []).map(r => r.evidence_id).filter(Boolean)
      console.log('Diagnostics: linked evidence IDs', linkedIds)

      if (!linkedIds.length) {
        console.warn('Diagnostics: No linked evidence IDs for this claim')
      }

      // Try batch fetch of evidence
      const { data: evBatch, error: evBatchErr } = linkedIds.length
        ? await supabase.from('evidence').select('id,user_id,case_number,display_order,title,file_name,created_at').in('id', linkedIds)
        : { data: [] as any[], error: null as any }
      if (evBatchErr) {
        console.error('Diagnostics: evidence batch select error', evBatchErr)
      } else {
        console.log('Diagnostics: evidence batch count', evBatch?.length || 0)
        console.log('Diagnostics: evidence batch sample', evBatch?.slice(0, 5))
      }

      // Probe first few individually to detect partial RLS blocks
      for (const probeId of linkedIds.slice(0, 5)) {
        try {
          const { data: single, error: singleErr } = await supabase
            .from('evidence')
            .select('id,user_id,case_number,display_order,title,file_name,created_at')
            .eq('id', probeId)
            .maybeSingle()
          if (singleErr) {
            console.warn('Diagnostics: single evidence blocked', { probeId, error: singleErr })
          } else {
            console.log('Diagnostics: single evidence ok', single)
          }
        } catch (e) {
          console.warn('Diagnostics: single evidence probe failed', { probeId, error: e })
        }
      }

      console.log('Diagnostics: complete')
    } catch (e) {
      console.error('Diagnostics: unexpected failure', e)
    } finally {
      setDiagnosticsRunning(false)
    }
  }

  const updateDisplayOrderMutation = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      // Update each item individually to avoid RLS issues
      for (const update of updates) {
        const { error } = await supabase
        .from('evidence')
          .update({ display_order: update.display_order })
          .eq('id', update.id)
      if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', selectedClaim] })
    }
  })



  const updateEvidenceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<Evidence> }) => {
      console.log('EvidenceManager: Updating evidence with data:', data)
      console.log('EvidenceManager: Original filename:', data.file_name)

      // Clean the data before submission
      const cleanData = {
        ...data,
        number_of_pages: data.number_of_pages ? parseInt(String(data.number_of_pages)) : null,
        date_submitted: data.date_submitted || null
      }
      
      console.log('EvidenceManager: Clean data filename:', cleanData.file_name)

      const { data: result, error } = await supabase
        .from('evidence')
        .update(cleanData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      console.log('EvidenceManager: Database returned filename:', result?.file_name)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      setEditingEvidence(null)
    },
    onError: (error: any) => {
      console.error('Evidence update error:', error)
      alert(`Failed to update evidence: ${error.message || 'Unknown error'}`)
    }
  })

  const deleteEvidenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('evidence')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
    }
  })


  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverItem(itemId)
  }

  const handleDragLeave = () => {
    setDragOverItem(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem === targetId || !evidenceData) return
    
    const draggedIndex = evidenceData.findIndex(item => item.id === draggedItem)
    const targetIndex = evidenceData.findIndex(item => item.id === targetId)
    
    if (draggedIndex === -1 || targetIndex === -1) return
    
    // Create new order
    const newOrder = [...evidenceData]
    const [draggedElement] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedElement)
    
    // Update display_order for all items (1-based indexing, ascending order)
    const updates = newOrder.map((item, index) => ({
      id: item.id,
      display_order: newOrder.length - index
    }))
    
    updateDisplayOrderMutation.mutate(updates)
    
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const downloadFile = (url?: string, filename?: string) => {
    if (!url) return
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = filename || ''
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      // Fallback: open in new tab if download fails
      window.open(url, '_blank')
    }
  }


  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvidence) return
    updateEvidenceMutation.mutate({
      id: editingEvidence.id,
      data: editingEvidence
    })
  }

  const handleRowClick = (item: Evidence) => {
    if (amendMode) {
      if (expandedEvidence === item.id) {
        setExpandedEvidence(null)
        setEditingEvidence(null)
      } else {
        setExpandedEvidence(item.id)
        setEditingEvidence(item)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading evidence...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-smudge p-4">
        <div className="text-red-800">Error loading evidence: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Pending Evidence Review: show for both roles; host can approve, guest can withdraw */}
      {selectedClaim && currentUserId && !hidePendingReview && (
        <PendingEvidenceReview 
          selectedClaim={selectedClaim} 
          isOwner={!isGuest} 
        />
      )}
      

      {editingEvidence && (
        <div className="card-enhanced p-6 border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Edit Evidence</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={editingEvidence.title || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, title: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  placeholder="Enter evidence title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File Name</label>
                <input
                  type="text"
                  value={editingEvidence.file_name || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, file_name: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  placeholder="Enter file name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Replace File</label>
                <div className="relative">
                  <input
                    type="file"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file || !editingEvidence) return
                      
                      // Generate title from filename (force title case regardless of original case)
                      const fileName = file.name;
                      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
                      const titleCase = nameWithoutExt
                        .toLowerCase() // Force to lowercase first
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                      
                      // Upload new file using storage bucket
                      const fileExt = file.name.split('.').pop()
                      const filePath = `${editingEvidence.user_id || 'user'}/${Date.now()}.${fileExt}`
                      const { data: up, error: upErr } = await supabase.storage.from('evidence-files').upload(filePath, file)
                      if (upErr) {
                        console.error('Upload error:', upErr)
                        return
                      }
                      const { data: { publicUrl } } = supabase.storage.from('evidence-files').getPublicUrl(filePath)
                      
                      // Update evidence with new file and auto-generated title
                      setEditingEvidence({ 
                        ...editingEvidence, 
                        file_url: publicUrl, 
                        file_name: file.name, // Preserve original case
                        title: titleCase
                      })
                    }}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold file:bg-white/10 file:text-gold file:border-0 file:mr-4 file:py-1 file:px-2 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  />
                  <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-yellow-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Exhibit Number</label>
                <input
                  type="number"
                  value={editingEvidence.exhibit_number || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, exhibit_number: parseInt(e.target.value) || null })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number of Pages</label>
                <input
                  type="number"
                  value={editingEvidence.number_of_pages || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, number_of_pages: parseInt(e.target.value) || null })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date Submitted</label>
                <input
                  type="date"
                  value={editingEvidence.date_submitted || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, date_submitted: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={editingEvidence.method || 'Todo'}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, method: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                >
                  <option value="Post">Post</option>
                  <option value="Todo">To-Do</option>
                  <option value="Email">Email</option>
                  <option value="Hand">Hand</option>
                  <option value="Call">Call</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL Link</label>
                <input
                  type="url"
                  value={editingEvidence.url_link || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, url_link: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
            </div>
            {/* Description removed per requirements */}
            <div>
              <label className="block text-sm font-medium mb-1">CLC Ref#</label>
              <input
                type="text"
                value={editingEvidence.book_of_deeds_ref || ''}
                onChange={(e) => setEditingEvidence({ ...editingEvidence, book_of_deeds_ref: e.target.value })}
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
              />
            </div>
            <div className="flex space-x-3 mb-4">
              <button
                type="submit"
                disabled={updateEvidenceMutation.isPending}
                className="px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ 
                  backgroundColor: 'rgba(30, 58, 138, 0.3)',
                  border: '2px solid #10b981',
                  color: '#10b981'
                }}
              >
                {updateEvidenceMutation.isPending ? 'Updating...' : 'Update Evidence'}
              </button>
              <button
                type="button"
                onClick={() => setEditingEvidence(null)}
                className="bg-yellow-400/20 text-gold px-4 py-2 rounded-lg hover:bg-yellow-400/30"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Evidence Table - Hide when editing */}
      {!editingEvidence && (
        <div className={`card-enhanced overflow-hidden mt-12 ${isStatic ? 'min-h-[75vh]' : ''}`}>
        <div className="px-6 py-4 border-b border-yellow-400/20 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gold">Evidence List</h3>
          <div className="flex items-center gap-2">
            {/* Quick Filters */}
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search title or method"
              className="px-2 h-8 rounded bg-white/10 border border-yellow-400/40 text-gold placeholder-yellow-300/70"
            />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2 h-8 rounded bg-white/10 border border-yellow-400/40 text-gold"
            >
              <option value="">All methods</option>
              <option value="post">Post</option>
              <option value="email">Email</option>
              <option value="hand">Hand</option>
              <option value="call">Call</option>
              <option value="todo">To-Do</option>
            </select>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-2 h-8 rounded bg-white/10 border border-yellow-400/40 text-gold"
            >
              <option value="">All tags</option>
              <option value="Needs review">Needs review</option>
              <option value="Approved">Approved</option>
              <option value="Requires action">Requires action</option>
            </select>
            {/* Column visibility */}
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={columnPrefs.showMethod} onChange={(e) => setColumnPrefs({ ...columnPrefs, showMethod: e.target.checked })} />
              Method
            </label>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={columnPrefs.showPages} onChange={(e) => setColumnPrefs({ ...columnPrefs, showPages: e.target.checked })} />
              Pages
            </label>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={columnPrefs.showExhibit} onChange={(e) => setColumnPrefs({ ...columnPrefs, showExhibit: e.target.checked })} />
              Exhibit
            </label>
            {!isGuest && (
              <label className="flex items-center gap-2 text-xs text-gold/80 mr-2">
                <input
                  type="checkbox"
                  checked={!!hostGuestDownloadAllowed}
                  onChange={(e) => toggleGuestDownloads(e.target.checked)}
                />
                <span>Guest downloads</span>
              </label>
            )}
            {!isGuest && (
              <label className="flex items-center gap-2 text-xs text-gold/80 mr-2">
                <input
                  type="checkbox"
                  checked={!!autoApproveTrusted}
                  onChange={(e) => saveAutoApproveTrusted(e.target.checked)}
                />
                <span>Auto-approve trusted</span>
              </label>
            )}
            
            {/* Order: Add, Amend, Link, then Show. Keep Add visible even when collapsed */}
            {isInteractive && (!isGuest || (isGuest && !isGuestFrozen)) && (
              <button
                onClick={() => {
                  if (!selectedClaim) {
                    alert('Please select a claim before adding evidence. The Case Number is required.')
                    return
                  }
                  setShowAddModal(true)
                }}
                disabled={!selectedClaim}
                className="bg-white/10 border border-green-400 text-green-400 px-3 h-8 rounded-lg flex items-center space-x-2 hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                <span>{isGuest ? 'Submit' : 'Add'}</span>
              </button>
            )}
            {!isCollapsed && onSetAmendMode && isInteractive && (
              <button
                onClick={() => onSetAmendMode(!amendMode)}
                className={`px-3 h-8 rounded-lg flex items-center space-x-2 bg-white/10 border border-red-400 text-red-400 hover:opacity-90`}
              >
                <Settings className="w-4 h-4" />
                <span>{amendMode ? 'Exit Amend' : 'Amend'}</span>
              </button>
            )}
            {!isCollapsed && isInteractive && !isGuest && false && (
              <button
                onClick={async () => {
                  if (!selectedClaim) {
                    alert('Please select a claim before linking evidence. The Case Number is required.')
                    return
                  }
                  try {
                    // Resolve claim_id
                    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
                    let resolvedClaimId: string | null = null
                    if (uuidPattern.test(selectedClaim)) {
                      resolvedClaimId = selectedClaim
                    } else {
                      resolvedClaimId = await getClaimIdFromCaseNumber(selectedClaim)
                    }
                    if (!resolvedClaimId) {
                      alert('Could not resolve claim ID for linking.')
                      return
                    }

                    // Find claim owner
                    const { data: claimInfo } = await supabase
                      .from('claims')
                      .select('user_id')
                      .eq('claim_id', resolvedClaimId)
                      .maybeSingle()
                    const ownerId = claimInfo?.user_id || null

                    // Get currently linked evidence ids for this claim
                    const { data: existingLinks } = await supabase
                      .from('evidence_claims')
                      .select('evidence_id')
                      .eq('claim_id', resolvedClaimId)
                    const linkedIds = (existingLinks || []).map(r => r.evidence_id)

                    // Fetch available evidence owned by owner and not already linked
                    let query = supabase
                      .from('evidence')
                      .select('*')
                    if (ownerId) query = query.eq('user_id', ownerId)
                    if (linkedIds.length) query = query.not('id', 'in', `(${linkedIds.join(',')})`)
                    const { data: avail } = await query

                    setAvailableEvidence((avail as any) || [])
                    setShowLinkModal(true)
                  } catch (e) {
                    console.warn('Failed to load available evidence for linking:', e)
                    setAvailableEvidence([])
                    setShowLinkModal(true)
                  }
                }}
                disabled={!selectedClaim}
                className="bg-white/10 border border-white text-white px-3 h-8 rounded-lg flex items-center space-x-2 hover:opacity-90"
              >
                <Link className="w-4 h-4" />
                <span>Link</span>
              </button>
            )}
            {!isCollapsed && !isGuest && amendMode && Object.values(selectedIds).some(Boolean) && (
              <button
                onClick={async () => {
                  try {
                    const target = window.prompt('Enter target Case Number (or claim UUID) to link selected evidence to:')
                    if (!target) return
                    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
                    const targetClaimId = uuidPattern.test(target) ? target : await getClaimIdFromCaseNumber(target)
                    if (!targetClaimId) {
                      alert('Could not resolve target claim')
                      return
                    }
                    const ids = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k)
                    for (const id of ids) {
                      await supabase.from('evidence_claims').insert({ evidence_id: id, claim_id: targetClaimId })
                    }
                    setSelectedIds({})
                    toast({ title: 'Linked', description: `Linked ${ids.length} item(s)` })
                  } catch (e) {
                    console.warn('Bulk link failed', e)
                    alert('Failed to link selected items')
                  }
                }}
                className="bg-white/10 border border-white text-white px-3 h-8 rounded-lg flex items-center space-x-2 hover:opacity-90"
              >
                <Link className="w-4 h-4" />
                <span>Link Selected</span>
              </button>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="bg-white/10 border border-yellow-400 text-yellow-400 px-3 h-8 rounded-lg flex items-center space-x-2 hover:opacity-90"
              title={isCollapsed ? 'Show evidence' : 'Hide evidence'}
            >
              <span>{isCollapsed ? 'Show' : 'Hide'}</span>
            </button>
          </div>
        </div>
        {amendMode && !isCollapsed && (
          <div className="px-6 py-3 bg-yellow-400/10 border-b border-yellow-400/20 text-xs text-gold flex items-center justify-between">
            <div>
              Amend mode enabled: drag to reorder, bulk select, delete, and toggle guest access per item.
            </div>
            <button
              onClick={() => onSetAmendMode?.(false)}
              className="px-2 py-1 rounded bg-white/10 border border-red-400 text-red-400"
            >
              Exit
            </button>
          </div>
        )}
        {!isCollapsed && (
          <div className={`${isStatic ? 'max-h-[75vh] overflow-y-auto overflow-x-hidden' : ''} ${!isStatic ? 'overflow-x-auto' : ''}`} style={{ scrollbarGutter: isStatic ? 'stable both-edges' as any : undefined }}>
            <table className={`min-w-full ${isStatic ? 'table-fixed' : 'table-auto'} divide-y divide-yellow-400/20`}>
            <thead className="bg-yellow-400/10">
              <tr>
                {!isGuest && amendMode && (
                  <th className={`px-2 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-12' : 'w-10'}`}>
                    <input
                      type="checkbox"
                      checked={filteredEvidence.every((e) => selectedIds[e.id as any]) && filteredEvidence.length > 0}
                      onChange={(e) => {
                        const next: Record<string, boolean> = { ...selectedIds }
                        if (e.target.checked) {
                          for (const it of filteredEvidence) next[it.id as any] = true
                        } else {
                          for (const it of filteredEvidence) delete next[it.id as any]
                        }
                        setSelectedIds(next)
                      }}
                      title="Select all filtered"
                    />
                  </th>
                )}
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-48' : ''}`}>
                  File Name
                </th>
                {columnPrefs.showMethod && (
                  <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                    Method
                  </th>
                )}
                {columnPrefs.showPages && (
                  <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-16' : ''}`}>
                    Pages
                  </th>
                )}
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-24' : ''}`}>
                  Date Submitted
                </th>
                {columnPrefs.showExhibit && (
                  <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                    Exhibit #
                  </th>
                )}
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-24' : ''}`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="card-enhanced divide-y divide-gray-200">
              {filteredEvidence && filteredEvidence.length > 0 ? (
                filteredEvidence.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr 
                      draggable={isInteractive && amendMode}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, item.id)}
                      onDragEnd={handleDragEnd}
                      className={`${isInteractive ? 'hover:bg-yellow-400/10' : ''} ${isInteractive && amendMode ? 'cursor-pointer' : ''} ${
                        expandedEvidence === item.id ? 'bg-yellow-400/20' : ''
                      } ${dragOverItem === item.id ? 'border-t-2 border-blue-500' : ''} ${
                        draggedItem === item.id ? 'opacity-50' : ''
                      } align-middle ${isStatic ? 'h-14' : 'h-12'}`}
                      onClick={() => (isInteractive ? handleRowClick(item) : undefined)}
                    >
                    {/* Order column hidden as requested */}
                    {!isGuest && amendMode && (
                      <td className={`px-2 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                        <input
                          type="checkbox"
                          checked={!!selectedIds[item.id]}
                          onChange={(e) => setSelectedIds({ ...selectedIds, [item.id]: e.target.checked })}
                          title="Select for bulk link"
                        />
                      </td>
                    )}
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-900`}>
                      {item.title || item.file_name || item.name || '-'}
                    </td>
                    {columnPrefs.showMethod && (
                      <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                        {item.method || '-'}
                      </td>
                    )}
                    {columnPrefs.showPages && (
                      <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                        {item.number_of_pages || '-'}
                      </td>
                    )}
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                      {item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : '-'}
                    </td>
                    {columnPrefs.showExhibit && (
                      <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                        {item.exhibit_number || '-'}
                      </td>
                    )}
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm font-medium`}>
                      <div className="flex space-x-2">
                        {item.file_url && (!isGuest || (guestDownloadAllowed && (linkPermissions[item.id] !== false))) && (
                          <>
                          <button
                              onClick={() => window.open(item.file_url as string, '_blank')}
                            className="text-blue-600 hover:text-blue-900"
                            title="View file"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadFile(item.file_url as string, item.file_name || item.title || 'evidence')
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Download file"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {!isGuest && amendMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteEvidenceMutation.mutate(item.id)
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Delete evidence"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                        {!isGuest && amendMode && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                const allowed = !(linkPermissions[item.id] !== false)
                                const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
                                let claimId: string | null = null
                                if (selectedClaim) {
                                  claimId = uuidPattern.test(selectedClaim) ? selectedClaim : await getClaimIdFromCaseNumber(selectedClaim)
                                }
                                if (!claimId) return
                                await supabase
                                  .from('evidence_claims')
                                  .update({ guest_download_allowed: allowed })
                                  .eq('claim_id', claimId)
                                  .eq('evidence_id', item.id)
                                setLinkPermissions({ ...linkPermissions, [item.id]: allowed })
                              } catch (err) {
                                console.warn('Failed to update guest_download_allowed', err)
                              }
                            }}
                            className={`text-xs px-2 py-1 rounded border ${linkPermissions[item.id] !== false ? 'text-green-600 border-green-600' : 'text-gray-500 border-gray-400'}`}
                            title="Toggle guest download for this item"
                          >
                            {linkPermissions[item.id] !== false ? 'Guest On' : 'Guest Off'}
                          </button>
                        )}
                        {/* Removed duplicate delete button - now handled above */}
                      </div>
                    </td>
                    </tr>
                    {expandedEvidence === item.id && editingEvidence && (
                      <tr>
                        <td colSpan={isGuest ? 6 : 7} className="px-6 py-4 bg-yellow-400/10 border-t">
                          <div className="card-enhanced p-6 border-l-4" style={{ borderLeftColor: claimColor }}>
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-lg font-semibold">Edit Evidence</h4>
                              <button
                                onClick={() => {
                                  setExpandedEvidence(null)
                                  setEditingEvidence(null)
                                }}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                            <form onSubmit={handleUpdate} className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={editingEvidence.title || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, title: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                    placeholder="Enter evidence title"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">File Name</label>
                                  <input
                                    type="text"
                                    value={editingEvidence.file_name || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, file_name: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                    placeholder="Enter file name"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-sm font-medium mb-1">Replace File</label>
                                  <div className="relative">
                                    <input
                                      type="file"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file || !editingEvidence) return
                                        
                                        // Generate title from filename (force title case regardless of original case)
                                        const fileName = file.name;
                                        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
                                        const titleCase = nameWithoutExt
                                          .toLowerCase() // Force to lowercase first
                                          .split(' ')
                                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                          .join(' ');
                                        
                                        // Upload new file using storage bucket
                                        const fileExt = file.name.split('.').pop()
                                        const filePath = `${editingEvidence.user_id || 'user'}/${Date.now()}.${fileExt}`
                                        const { data: up, error: upErr } = await supabase.storage.from('evidence-files').upload(filePath, file)
                                        if (upErr) {
                                          console.error('Upload error:', upErr)
                                          return
                                        }
                                        const { data: { publicUrl } } = supabase.storage.from('evidence-files').getPublicUrl(filePath)
                                        
                                        // Update evidence with new file and auto-generated title
                                        setEditingEvidence({ 
                                          ...editingEvidence, 
                                          file_url: publicUrl, 
                                          file_name: file.name, // Preserve original case
                                          title: titleCase
                                        })
                                      }}
                                      className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold file:bg-white/10 file:text-gold file:border-0 file:mr-4 file:py-1 file:px-2 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                    />
                                    <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-yellow-400 pointer-events-none" />
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Exhibit Number</label>
                                  <input
                                    type="number"
                                    value={editingEvidence.exhibit_number || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, exhibit_number: parseInt(e.target.value) || null })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Number of Pages</label>
                                  <input
                                    type="number"
                                    value={editingEvidence.number_of_pages || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, number_of_pages: parseInt(e.target.value) || null })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Date Submitted</label>
                                  <input
                                    type="date"
                                    value={editingEvidence.date_submitted || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, date_submitted: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Method</label>
                                  <select
                                    value={editingEvidence.method || 'Post'}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, method: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  >
                                    <option value="Post">Post</option>
                                    <option value="Email">Email</option>
                                    <option value="Hand">Hand</option>
                                    <option value="Call">Call</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">URL Link</label>
                                  <input
                                    type="url"
                                    value={editingEvidence.url_link || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, url_link: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">CLC Ref#</label>
                                <input
                                  type="text"
                                  value={editingEvidence.book_of_deeds_ref || ''}
                                  onChange={(e) => setEditingEvidence({ ...editingEvidence, book_of_deeds_ref: e.target.value })}
                                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                />
                              </div>
                              <div className="flex space-x-3">
                                <button
                                  type="submit"
                                  disabled={updateEvidenceMutation.isPending}
                                  className="px-4 py-2 rounded-lg disabled:opacity-50"
                                  style={{ 
                                    backgroundColor: 'rgba(30, 58, 138, 0.3)',
                                    border: '2px solid #10b981',
                                    color: '#10b981'
                                  }}
                                >
                                  {updateEvidenceMutation.isPending ? 'Updating...' : 'Update Evidence'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedEvidence(null)
                                    setEditingEvidence(null)
                                  }}
                                  className="bg-yellow-400/20 text-gold px-4 py-2 rounded-lg hover:bg-yellow-400/30"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No evidence found. Add some evidence to get started!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
      )}

      {/* Add Evidence Modal */}
      {showAddModal && (
        <AddEvidenceModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          selectedClaim={selectedClaim}
          initialExhibitRef={(function(){
            const list = evidenceData?.filter(e => e.case_number === selectedClaim) || []
            const nums = list.map(e => {
              const fromNum = (e as any).exhibit_number
              return fromNum !== null && fromNum !== undefined && typeof fromNum === 'number' ? fromNum : 0
            })
            const max = nums.length ? Math.max(...nums) : 0
            return `Exhibit ${max + 1}`
          })()}
          onAdd={async (evidence) => {
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) throw new Error('Not authenticated')
              if (!selectedClaim) throw new Error('A Case Number (claim) is required for evidence')

              // Get the current maximum display_order for this user
              const { data: maxOrderData } = await supabase
                .from('evidence')
                .select('display_order')
                .eq('user_id', user.id)
                .not('display_order', 'is', null)
                .order('display_order', { ascending: false })
                .limit(1)
              const maxDisplayOrder = maxOrderData?.[0]?.display_order || 0
              const newDisplayOrder = maxDisplayOrder + 1

              // Clean the data before submission - only include valid evidence table fields
              // Explicitly exclude exhibit_id and other invalid fields
              const { exhibit_id, id, claimIds, ...evidenceWithoutInvalidFields } = evidence as any
              
              const cleanData: any = {
                title: evidence.title || 'Untitled Evidence',
                file_name: evidence.file_name || null,
                file_url: evidence.file_url || null,
                description: evidence.description || null,
                user_id: user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }

              // Only include these fields if they exist in the evidence object and are valid
              if (evidence.exhibit_number !== undefined && evidence.exhibit_number !== null) {
                cleanData.exhibit_number = evidence.exhibit_number
              }
              if (evidence.number_of_pages !== undefined && evidence.number_of_pages !== null) {
                cleanData.number_of_pages = evidence.number_of_pages
              }
              if (evidence.date_submitted) {
                cleanData.date_submitted = evidence.date_submitted
              }
              if (evidence.method) {
                cleanData.method = evidence.method
              }
              if (evidence.url_link) {
                cleanData.url_link = evidence.url_link
              }
              if (evidence.book_of_deeds_ref) {
                cleanData.book_of_deeds_ref = evidence.book_of_deeds_ref
              }
              if (newDisplayOrder !== undefined) {
                cleanData.display_order = newDisplayOrder
              }

              // Debug: Log what we received vs what we're inserting
              console.log('EvidenceManager: Original evidence object keys:', Object.keys(evidence))
              if ((evidence as any).exhibit_id) {
                console.warn('EvidenceManager: WARNING - evidence object contains exhibit_id (invalid field):', (evidence as any).exhibit_id)
              }
              console.log('EvidenceManager: Inserting evidence with cleanData keys:', Object.keys(cleanData))
              console.log('EvidenceManager: Inserting evidence with data:', cleanData)
              console.log('EvidenceManager: User ID:', user.id)

              const { data: insertedEvidence, error } = await supabase
                .from('evidence')
                .insert([cleanData])
                .select('id, title, file_name, file_url, exhibit_number, number_of_pages, date_submitted, method, url_link, book_of_deeds_ref, description, created_at, updated_at, user_id, display_order')
                .single()

              if (error) {
                console.error('EvidenceManager: Insert error:', error)
                throw error
              }

              // Link evidence to claim via evidence_claims table
              const claimId = await getClaimIdFromCaseNumber(selectedClaim)
              if (claimId) {
                const { error: linkError } = await supabase
                  .from('evidence_claims')
                  .insert([{ evidence_id: insertedEvidence.id, claim_id: claimId }])

                if (linkError) {
                  console.error('Error linking evidence to claim:', linkError)
                  // Don't throw here, evidence was created successfully
                }

                // If guest submitted, create a pending_evidence record for host review
                if (isGuest) {
                  try {
                    await supabase
                      .from('pending_evidence')
                      .insert([{
                        claim_id: claimId,
                        submitter_id: user.id,
                        status: 'pending',
                        submitted_at: new Date().toISOString(),
                        description: evidence.title || evidence.file_name || '',
                        file_name: insertedEvidence.file_name || null,
                        file_url: insertedEvidence.file_url || null,
                        method: insertedEvidence.method || null,
                        url_link: insertedEvidence.url_link || null,
                        book_of_deeds_ref: insertedEvidence.book_of_deeds_ref || null,
                        number_of_pages: insertedEvidence.number_of_pages || null,
                        date_submitted: insertedEvidence.date_submitted || null
                      }])
                    // Refresh pending list for owner views
                    queryClient.invalidateQueries({ queryKey: ['pending-evidence', selectedClaim] })
                  } catch (err) {
                    console.warn('Failed to create pending_evidence entry:', err)
                  }
                }
              }

              // Close modal and refresh
              setShowAddModal(false)
              queryClient.invalidateQueries({ queryKey: ['evidence', selectedClaim] })
              
              toast({
                title: "Success",
                description: "Evidence added successfully!",
              })
            } catch (error) {
              console.error('Error adding evidence:', error)
              toast({
                title: "Error",
                description: `Failed to add evidence: ${error.message || 'Unknown error'}`,
                variant: "destructive",
              })
            }
          }}
          isGuest={isGuest}
          isGuestFrozen={isGuestFrozen}
        />
      )}

      {/* Link Evidence Modal */}
      {showLinkModal && selectedClaim && (
        <LinkEvidenceModal
          claim={{ case_number: selectedClaim } as any}
          availableEvidence={availableEvidence as any}
          onClose={() => setShowLinkModal(false)}
          onLink={async (evidenceId, claimId) => {
            try {
              // Get the claim_id for the selected claim
              const claimIdUuid = await getClaimIdFromCaseNumber(claimId)
              if (!claimIdUuid) {
                throw new Error('Could not find claim')
              }

              // Link evidence to claim via evidence_claims table
              const { error } = await supabase
                .from('evidence_claims')
                .insert([{ evidence_id: evidenceId, claim_id: claimIdUuid }])

              if (error) throw error

              // Refresh evidence data
              queryClient.invalidateQueries({ queryKey: ['evidence', selectedClaim] })
              
              toast({
                title: "Success",
                description: "Evidence linked successfully",
              })
            } catch (error) {
              console.error('Error linking evidence:', error)
              toast({
                title: "Error",
                description: `Failed to link evidence: ${error.message || 'Unknown error'}`,
                variant: "destructive",
              })
            }
          }}
        />
      )}
    </div>
  )
}

export default EvidenceManager