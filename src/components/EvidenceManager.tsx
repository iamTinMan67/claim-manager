import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Evidence } from '@/types/database'
import { Plus, Edit, Trash2, Upload, Download, Eye, X, Save, Settings, FileText, Calendar, Hash, GripVertical, Link } from 'lucide-react'
import PendingEvidenceReview from './PendingEvidenceReview'
import { AddEvidenceModal } from './AddEvidenceModal'
import { LinkEvidenceModal } from './LinkEvidenceModal'
import { CopyEvidenceModal } from './CopyEvidenceModal'
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
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [availableEvidence, setAvailableEvidence] = useState<Evidence[]>([])
  
  // Fetch claim title for Copy Evidence modal
  const { data: currentClaimTitle } = useQuery({
    queryKey: ['claim-title', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return ''
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      let claimId: string | null = null
      if (uuidPattern.test(selectedClaim)) {
        claimId = selectedClaim
      } else {
        claimId = await getClaimIdFromCaseNumber(selectedClaim)
      }
      if (!claimId) return ''
      const { data } = await supabase
        .from('claims')
        .select('title')
        .eq('claim_id', claimId)
        .maybeSingle()
      return data?.title || ''
    },
    enabled: !!selectedClaim && isGuest
  })
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
  const [columnPrefs, setColumnPrefs] = useState<{ showMethod: boolean; showPages: boolean; showBookOfDeeds: boolean; showCLCRef: boolean; showExhibitNumber: boolean }>(() => {
    return { showMethod: true, showPages: true, showBookOfDeeds: false, showCLCRef: false, showExhibitNumber: true }
  })
  const [autoApproveTrusted, setAutoApproveTrusted] = useState<boolean>(false)

  // Load column preferences per-claim (by case_number)
  useEffect(() => {
    try {
      if (!selectedClaim) return
      const raw = localStorage.getItem(`evidence_column_prefs_${selectedClaim}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Migrate old showExhibit to showBookOfDeeds
        if (parsed.showExhibit !== undefined && parsed.showBookOfDeeds === undefined) {
          parsed.showBookOfDeeds = parsed.showExhibit
          delete parsed.showExhibit
        }
        setColumnPrefs(parsed)
      } else {
        // Check for old global preferences and migrate them, then use defaults
        const globalRaw = localStorage.getItem('evidence_column_prefs')
        if (globalRaw) {
          try {
            const globalParsed = JSON.parse(globalRaw)
            if (globalParsed.showExhibit !== undefined && globalParsed.showBookOfDeeds === undefined) {
              globalParsed.showBookOfDeeds = globalParsed.showExhibit
              delete globalParsed.showExhibit
            }
            setColumnPrefs(globalParsed)
            // Save to per-claim storage
            localStorage.setItem(`evidence_column_prefs_${selectedClaim}`, JSON.stringify(globalParsed))
          } catch {}
        } else {
          // Use defaults
          setColumnPrefs({ showMethod: true, showPages: true, showBookOfDeeds: false, showCLCRef: false, showExhibitNumber: true })
        }
      }
    } catch {}
  }, [selectedClaim])

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
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false
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

  // Persist column preferences per-claim (by case_number)
  useEffect(() => {
    try {
      if (!selectedClaim) return
      localStorage.setItem(`evidence_column_prefs_${selectedClaim}`, JSON.stringify(columnPrefs))
    } catch {}
  }, [columnPrefs, selectedClaim])

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
        
        // Try to fetch guest_download_allowed, but handle gracefully if column doesn't exist
        const { data, error } = await supabase
          .from('evidence_claims')
          .select('evidence_id, guest_download_allowed')
          .eq('claim_id', claimId)
        
        // If column doesn't exist (400 error), default to allowing all downloads
        if (error) {
          console.warn('Could not load guest_download_allowed permissions (column may not exist):', error)
          // Still fetch evidence_ids to populate the map, defaulting to allowed
          const { data: linkData } = await supabase
            .from('evidence_claims')
            .select('evidence_id')
            .eq('claim_id', claimId)
          
          const map: Record<string, boolean> = {}
          ;(linkData || []).forEach((r: any) => {
            if (r.evidence_id) map[r.evidence_id] = true // Default to allowed
          })
          setLinkPermissions(map)
          return
        }
        
        const map: Record<string, boolean> = {}
        ;(data || []).forEach((r: any) => {
          if (r.evidence_id) map[r.evidence_id] = r.guest_download_allowed !== false
        })
        setLinkPermissions(map)
      } catch (err) {
        console.warn('Error loading guest download permissions:', err)
        // Default to empty map (all allowed)
        setLinkPermissions({})
      }
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
    mutationFn: async (updates: { id: string; display_order: number; exhibit_number?: number }[]) => {
      // Update each item individually to avoid RLS issues
      for (const update of updates) {
        const updateData: { display_order: number; exhibit_number?: number } = {
          display_order: update.display_order
        }
        // Include exhibit_number if provided
        if (update.exhibit_number !== undefined) {
          updateData.exhibit_number = update.exhibit_number
        }
        
        const { error } = await supabase
        .from('evidence')
          .update(updateData)
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

      // Clean the data - only include fields that can be updated
      // Exclude: id, created_at, updated_at, user_id, claimIds, display_order
      const { id: _, created_at: __, updated_at: ___, user_id: ____, claimIds: _____, display_order: ______, ...restData } = data as any
      
      // Convert date_submitted to yyyy-MM-dd format if it exists
      let formattedDate = null
      if (restData.date_submitted) {
        // If it's already in yyyy-MM-dd format, use it directly
        if (typeof restData.date_submitted === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(restData.date_submitted)) {
          formattedDate = restData.date_submitted
        } else {
          // Otherwise, parse and format it
          const date = new Date(restData.date_submitted)
          if (!isNaN(date.getTime())) {
            // Format as yyyy-MM-dd
            formattedDate = date.toISOString().split('T')[0]
          }
        }
      }
      
      // Handle number_of_pages - ensure it's always included if it exists (including 0)
      let number_of_pages_value: number | null = null
      if (restData.number_of_pages !== undefined && restData.number_of_pages !== null) {
        if (typeof restData.number_of_pages === 'number') {
          number_of_pages_value = restData.number_of_pages
        } else {
          const parsed = parseInt(String(restData.number_of_pages))
          number_of_pages_value = isNaN(parsed) ? null : parsed
        }
      }
      
      const cleanData: any = {
        title: restData.title || null,
        file_name: restData.file_name || null,
        file_url: restData.file_url || null,
        exhibit_number: restData.exhibit_number !== undefined && restData.exhibit_number !== null ? parseInt(String(restData.exhibit_number)) : null,
        number_of_pages: number_of_pages_value,
        date_submitted: formattedDate,
        method: restData.method || null,
        url_link: restData.url_link || null,
        book_of_deeds_ref: restData.book_of_deeds_ref || null,
        description: restData.description || null
        // Don't manually set updated_at - let Supabase handle it via triggers
      }
      
      console.log('EvidenceManager: number_of_pages - original:', restData.number_of_pages, 'type:', typeof restData.number_of_pages, '-> cleaned:', cleanData.number_of_pages, 'type:', typeof cleanData.number_of_pages)
      console.log('EvidenceManager: Full cleanData being sent:', JSON.stringify(cleanData, null, 2))

      console.log('EvidenceManager: Clean data being sent:', cleanData)
      console.log('EvidenceManager: Updating evidence with id:', id)

      // Perform the update without select to avoid 400 errors
      // We'll rely on refetch to get the updated data
      const { error: updateError, status, statusText } = await supabase
        .from('evidence')
        .update(cleanData)
        .eq('id', id)
      
      console.log('EvidenceManager: Update response status:', status, statusText)
      
      if (updateError) {
        console.error('EvidenceManager: Update error:', updateError)
        console.error('EvidenceManager: Update error details:', JSON.stringify(updateError, null, 2))
        throw updateError
      }
      
      console.log('EvidenceManager: Update successful, waiting briefly for database to process...')
      // Small delay to ensure database has processed the update
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Return the original data with updates applied - the refetch will get the real data from the database
      return { ...data, ...cleanData, id } as Evidence
    },
    onSuccess: async (data) => {
      console.log('EvidenceManager: Update mutation onSuccess called with data:', data)
      console.log('EvidenceManager: Refetching evidence list...')
      
      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['evidence', selectedClaim] })
      await queryClient.invalidateQueries({ queryKey: ['evidence'] })
      
      // Manually refetch the query
      try {
        const queryCache = queryClient.getQueryCache()
        const query = queryCache.find({ queryKey: ['evidence', selectedClaim] })
        if (query) {
          await queryClient.refetchQueries({ 
            queryKey: ['evidence', selectedClaim],
            type: 'active'
          })
          console.log('EvidenceManager: Refetch completed successfully')
        } else {
          console.warn('EvidenceManager: Query not found in cache, invalidating instead')
        }
      } catch (err) {
        console.error('EvidenceManager: Error during refetch:', err)
      }
      
      // Close the form
      setEditingEvidence(null)
      setExpandedEvidence(null)
      
      toast({
        title: "Success",
        description: "Evidence updated successfully!",
      })
    },
    onError: (error: any) => {
      console.error('Evidence update error:', error)
      alert(`Failed to update evidence: ${error.message || 'Unknown error'}`)
    }
  })

  const deleteEvidenceMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('EvidenceManager: Deleting evidence with id:', id)
      
      // Get current user to verify permissions
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }
      
      // Check if current user is the owner of the selected claim
      let userIsClaimOwner = false
      if (selectedClaim) {
        try {
          const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
          let claimId: string | null = null
          if (uuidPattern.test(selectedClaim)) {
            claimId = selectedClaim
          } else {
            claimId = await getClaimIdFromCaseNumber(selectedClaim)
          }
          if (claimId) {
            const { data: claim } = await supabase
              .from('claims')
              .select('user_id')
              .eq('claim_id', claimId)
              .maybeSingle()
            userIsClaimOwner = claim?.user_id === user.id
          }
        } catch (e) {
          console.warn('EvidenceManager: Error checking claim ownership:', e)
        }
      }
      
      // First, check if evidence exists and get its user_id
      const { data: evidenceCheck, error: checkError } = await supabase
        .from('evidence')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle()
      
      if (checkError) {
        console.error('EvidenceManager: Error checking evidence:', checkError)
        throw checkError
      }
      
      if (!evidenceCheck) {
        console.log('EvidenceManager: Evidence not found, may already be deleted')
        return id
      }
      
      // Verify permissions: user must either own the evidence OR be the claim owner (host)
      const userOwnsEvidence = evidenceCheck.user_id === user.id
      if (!userOwnsEvidence && !userIsClaimOwner) {
        console.error('EvidenceManager: User does not have permission to delete this evidence', { 
          evidenceUserId: evidenceCheck.user_id, 
          currentUserId: user.id,
          userIsClaimOwner
        })
        throw new Error('You do not have permission to delete this evidence')
      }
      
      console.log('EvidenceManager: Deletion authorized', { 
        userOwnsEvidence, 
        userIsClaimOwner,
        evidenceUserId: evidenceCheck.user_id,
        currentUserId: user.id
      })
      
      // If user is claim owner but doesn't own evidence, verify the evidence is linked to their claim
      if (userIsClaimOwner && !userOwnsEvidence && selectedClaim) {
        try {
          const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
          let claimId: string | null = null
          if (uuidPattern.test(selectedClaim)) {
            claimId = selectedClaim
          } else {
            claimId = await getClaimIdFromCaseNumber(selectedClaim)
          }
          
          if (claimId) {
            // Verify evidence is linked to this claim
            const { data: linkCheck, error: linkCheckError } = await supabase
              .from('evidence_claims')
              .select('id')
              .eq('evidence_id', id)
              .eq('claim_id', claimId)
              .maybeSingle()
            
            if (linkCheckError) {
              console.error('EvidenceManager: Error checking evidence_claims link:', linkCheckError)
            }
            
            if (!linkCheck) {
              throw new Error('This evidence is not linked to your claim. You cannot delete it.')
            }
            
            console.log('EvidenceManager: Verified evidence is linked to claim owned by user')
          }
        } catch (e: any) {
          if (e.message) {
            throw e
          }
        }
      }
      
      // Delete from pending_evidence first (if exists)
      try {
        const { error: pendingError } = await supabase
          .from('pending_evidence')
        .delete()
          .eq('evidence_id', id)
        
        if (pendingError && pendingError.code !== 'PGRST116') { // Ignore "table not found" errors
          console.warn('EvidenceManager: Could not delete from pending_evidence:', pendingError)
        }
      } catch (e) {
        console.warn('EvidenceManager: Error deleting from pending_evidence (may not exist):', e)
      }

      // Also clear case_number field if it exists (for legacy support)
      // Do this BEFORE deleting from evidence_claims so RLS can still check the link
      try {
        const { error: updateError } = await supabase
          .from('evidence')
          .update({ case_number: null })
        .eq('id', id)

        if (updateError && !updateError.message?.includes('column') && !updateError.message?.includes('does not exist')) {
          console.warn('EvidenceManager: Could not clear case_number:', updateError)
        }
      } catch (e) {
        console.warn('EvidenceManager: Error clearing case_number (column may not exist):', e)
      }

      // Try to use an RPC function if available for claim owner deletions
      // Otherwise, attempt direct deletion
      let deleteSuccess = false
      let deleteError: any = null
      let deleteData: any = null
      
      // If user is claim owner but doesn't own evidence, try RPC function first
      if (userIsClaimOwner && !userOwnsEvidence && selectedClaim) {
        try {
          const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
          let claimId: string | null = null
          if (uuidPattern.test(selectedClaim)) {
            claimId = selectedClaim
          } else {
            claimId = await getClaimIdFromCaseNumber(selectedClaim)
          }
          
          if (claimId) {
            // Try RPC function for claim owner deletion (if it exists)
            try {
              const { data: rpcData, error: rpcError } = await supabase.rpc(
                'delete_evidence_as_claim_owner' as any,
                { 
                  evidence_id_param: id,
                  claim_id_param: claimId
                }
              )
              
              if (!rpcError && rpcData) {
                console.log('EvidenceManager: Successfully deleted via RPC function')
                deleteSuccess = true
                deleteData = rpcData
              } else if (rpcError && rpcError.code !== '42883') { // 42883 = function does not exist
                console.warn('EvidenceManager: RPC function exists but returned error:', rpcError)
              }
            } catch (rpcErr: any) {
              // Function doesn't exist or other error - continue with direct deletion
              if (rpcErr.code !== '42883') {
                console.warn('EvidenceManager: RPC call failed:', rpcErr)
              }
            }
          }
        } catch (e) {
          console.warn('EvidenceManager: Error attempting RPC deletion:', e)
        }
      }
      
      // If RPC didn't work, try direct deletion
      if (!deleteSuccess) {
        // Delete from evidence table
        // If user owns the evidence, use user_id filter for RLS
        // If user is claim owner (host), try without user_id filter - RLS should allow based on claim ownership
        let deleteQuery = supabase
          .from('evidence')
          .delete()
          .eq('id', id)
        
        // Add user_id filter only if user owns the evidence
        // If user is claim owner but doesn't own evidence, RLS policy should allow deletion based on claim ownership
        if (userOwnsEvidence) {
          deleteQuery = deleteQuery.eq('user_id', user.id)
        }
        // Note: If userIsClaimOwner && !userOwnsEvidence, we don't add user_id filter
        // The RLS policy should check if the user owns a claim that the evidence is linked to
        
        const result = await deleteQuery.select()
        deleteError = result.error
        deleteData = result.data
      }
      
      // Delete from evidence_claims junction table
      // Do this regardless of whether evidence deletion succeeded, to clean up the link
      const { error: linkError, data: linkData } = await supabase
        .from('evidence_claims')
        .delete()
        .eq('evidence_id', id)
        .select()

      if (linkError) {
        console.error('Error deleting evidence_claims links:', linkError)
        // Continue even if this fails, as the evidence deletion might still work
      } else {
        console.log('EvidenceManager: Deleted evidence_claims links:', linkData?.length || 0)
      }
      
      const error = deleteError
      const data = deleteData

      if (error) {
        console.error('EvidenceManager: Error deleting evidence:', error)
        console.error('EvidenceManager: Error details:', JSON.stringify(error, null, 2))
        
        // If error and user is claim owner, the RLS policy is blocking
        // Provide detailed error message with SQL instructions
        if (userIsClaimOwner && !userOwnsEvidence) {
          const errorMsg = error.message || 'Unknown error'
          const detailedError = `Failed to delete guest-submitted evidence. The Row Level Security (RLS) policy on the 'evidence' table is preventing deletion.

Error: ${errorMsg}

To fix this, run the following SQL in your Supabase SQL Editor:

-- First, drop the existing DELETE policy if it exists (adjust name if different)
DROP POLICY IF EXISTS "Users can delete their own evidence" ON evidence;
DROP POLICY IF EXISTS "Claim owners can delete evidence linked to their claims" ON evidence;

-- Create a new policy that allows both:
-- 1. Users to delete their own evidence
-- 2. Claim owners to delete evidence linked to their claims
CREATE POLICY "Users and claim owners can delete evidence"
ON evidence FOR DELETE
USING (
  -- User owns the evidence
  user_id = auth.uid()
  OR
  -- User owns a claim that the evidence is linked to
  EXISTS (
    SELECT 1 FROM evidence_claims ec
    JOIN claims c ON c.claim_id = ec.claim_id
    WHERE ec.evidence_id = evidence.id
    AND c.user_id = auth.uid()
  )
);`
          
          console.error('EvidenceManager: RLS Policy Error - Detailed instructions:', detailedError)
          throw new Error(detailedError)
        }
        throw error
      }
      
      console.log('EvidenceManager: Deleted evidence response:', { data, dataLength: data?.length || 0 })
      
      // Note: Supabase delete with .select() may return empty array even on success
      // So we verify by checking if the item still exists
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const { data: checkData, error: checkErr } = await supabase
        .from('evidence')
        .select('id')
        .eq('id', id)
        .maybeSingle()
      
      if (checkErr) {
        console.error('EvidenceManager: Error checking if evidence exists:', checkErr)
        // If we can't check, assume deletion worked if no error was thrown
        return id
      }
      
      if (checkData) {
        console.error('EvidenceManager: ERROR - Evidence still exists after delete attempt!')
        
        // If user is claim owner but doesn't own evidence, try a different approach
        // Check if evidence is linked to the claim via evidence_claims
        if (userIsClaimOwner && !userOwnsEvidence && selectedClaim) {
          try {
            const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
            let claimId: string | null = null
            if (uuidPattern.test(selectedClaim)) {
              claimId = selectedClaim
            } else {
              claimId = await getClaimIdFromCaseNumber(selectedClaim)
            }
            
            if (claimId) {
              // Verify evidence is linked to this claim
              const { data: linkCheck } = await supabase
                .from('evidence_claims')
                .select('id')
                .eq('evidence_id', id)
                .eq('claim_id', claimId)
                .maybeSingle()
              
              if (linkCheck) {
                console.log('EvidenceManager: Evidence is linked to claim, but deletion failed due to RLS policy')
                // The RLS policy is preventing deletion - provide SQL instructions
                const detailedError = `Failed to delete guest-submitted evidence. The Row Level Security (RLS) policy on the 'evidence' table is preventing deletion.

The evidence is linked to your claim, but the database policy is blocking the deletion.

To fix this, run the following SQL in your Supabase SQL Editor:

-- First, drop the existing DELETE policy if it exists (adjust name if different)
DROP POLICY IF EXISTS "Users can delete their own evidence" ON evidence;
DROP POLICY IF EXISTS "Claim owners can delete evidence linked to their claims" ON evidence;

-- Create a new policy that allows both:
-- 1. Users to delete their own evidence
-- 2. Claim owners to delete evidence linked to their claims
CREATE POLICY "Users and claim owners can delete evidence"
ON evidence FOR DELETE
USING (
  -- User owns the evidence
  user_id = auth.uid()
  OR
  -- User owns a claim that the evidence is linked to
  EXISTS (
    SELECT 1 FROM evidence_claims ec
    JOIN claims c ON c.claim_id = ec.claim_id
    WHERE ec.evidence_id = evidence.id
    AND c.user_id = auth.uid()
  )
);`
                
                console.error('EvidenceManager: RLS Policy Error - Detailed instructions:', detailedError)
                throw new Error(detailedError)
              }
            }
          } catch (e: any) {
            if (e.message) {
              throw e
            }
          }
        }
        
        // Try one more time with user_id if user owns it
        if (userOwnsEvidence) {
          const { error: retryError } = await supabase
            .from('evidence')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
          
          if (retryError) {
            console.error('EvidenceManager: Retry delete also failed:', retryError)
            throw new Error(`Failed to delete evidence: ${retryError.message || 'Unknown error'}. You may not have permission to delete this item.`)
          }
          
          // Check one more time after retry
          await new Promise(resolve => setTimeout(resolve, 300))
          const { data: finalCheck } = await supabase
            .from('evidence')
            .select('id')
            .eq('id', id)
            .maybeSingle()
          
          if (finalCheck) {
            throw new Error('Failed to delete evidence - item still exists after retry. This may be due to database permissions or foreign key constraints.')
          } else {
            console.log('EvidenceManager: Deletion succeeded on retry')
          }
        } else {
          throw new Error('Failed to delete evidence - item still exists. The database policy may need to allow claim owners to delete guest-submitted evidence.')
        }
      } else {
        console.log('EvidenceManager: Deletion verified - evidence no longer exists')
      }
      
      // Wait a moment to ensure database has processed the deletion
      await new Promise(resolve => setTimeout(resolve, 500))
      
      return id
    },
    onSuccess: async (deletedId) => {
      console.log('EvidenceManager: Delete mutation onSuccess, deletedId:', deletedId)
      
      // Immediately remove from cache to update UI instantly
      const updatedData = queryClient.setQueryData(['evidence', selectedClaim], (oldData: Evidence[] | undefined) => {
        if (!oldData) return oldData
        const filtered = oldData.filter(item => item.id !== deletedId)
        console.log('EvidenceManager: Removed from cache, old count:', oldData.length, 'new count:', filtered.length)
        return filtered
      })
      
      // Also update the general evidence cache
      queryClient.setQueryData(['evidence'], (oldData: Evidence[] | undefined) => {
        if (!oldData) return oldData
        return oldData.filter(item => item.id !== deletedId)
      })
      
      // Renumber all remaining exhibits based on their new positions
      setTimeout(async () => {
        try {
          // Get the updated evidence list from cache
          const currentEvidence = queryClient.getQueryData<Evidence[]>(['evidence', selectedClaim]) || []
          
          // Sort by display_order descending (to match the display order)
          const sortedEvidence = [...currentEvidence].sort((a, b) => {
            const ao = a.display_order ?? -Infinity
            const bo = b.display_order ?? -Infinity
            if (ao !== bo) return bo - ao
            const at = new Date(a.created_at).getTime()
            const bt = new Date(b.created_at).getTime()
            return bt - at
          })
          
          // Renumber all exhibits based on their position (1, 2, 3...)
          const renumberUpdates = sortedEvidence.map((evidence, index) => ({
            id: evidence.id,
            display_order: sortedEvidence.length - index,
            exhibit_number: index + 1
          }))
          
          // Update all exhibits with new numbers
          if (renumberUpdates.length > 0) {
            console.log('EvidenceManager: Renumbering exhibits after deletion:', renumberUpdates)
            await updateDisplayOrderMutation.mutateAsync(renumberUpdates)
          }
        } catch (e) {
          console.error('EvidenceManager: Error renumbering exhibits after deletion:', e)
        }
      }, 500)
      
      // Verify deletion and refresh the list
      setTimeout(async () => {
        try {
          const { data: verifyData, error: verifyError } = await supabase
            .from('evidence')
            .select('id')
            .eq('id', deletedId)
            .maybeSingle()
          
          if (verifyError) {
            console.error('EvidenceManager: Error verifying deletion:', verifyError)
          } else if (verifyData) {
            console.error('EvidenceManager: CRITICAL - Evidence still exists after deletion!', deletedId)
            // Try to delete again with more aggressive approach
            await supabase.from('evidence_claims').delete().eq('evidence_id', deletedId)
            await supabase.from('evidence').delete().eq('id', deletedId)
            // Update cache to remove it anyway
            queryClient.setQueryData(['evidence', selectedClaim], (oldData: Evidence[] | undefined) => {
              if (!oldData) return oldData
              return oldData.filter(item => item.id !== deletedId)
            })
          } else {
            console.log('EvidenceManager: Deletion verified - evidence no longer exists')
          }
        } catch (e) {
          console.error('EvidenceManager: Error during verification:', e)
        }
        
        // Invalidate and refetch to get updated exhibit numbers
        queryClient.invalidateQueries({ queryKey: ['evidence', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      }, 1500)
      
      toast({
        title: "Success",
        description: "Evidence deleted successfully!",
      })
    },
    onError: (error: any) => {
      console.error('Evidence delete error:', error)
      toast({
        title: "Error",
        description: `Failed to delete evidence: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      })
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
    
    // Update display_order and exhibit_number for all items
    // display_order: descending (highest first, since list is sorted descending)
    // exhibit_number: ascending (1, 2, 3... based on position in list)
    const updates = newOrder.map((item, index) => ({
      id: item.id,
      display_order: newOrder.length - index,
      exhibit_number: index + 1 // Position 0 = Exhibit 1, Position 1 = Exhibit 2, etc.
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
        <div className="card-enhanced p-6 border-l-4" style={{ borderLeftColor: claimColor, width: '700px' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Edit Evidence</h3>
            <button
              type="button"
              onClick={() => setEditingEvidence(null)}
              className="bg-transparent text-red-600 border border-red-600 p-2 rounded-lg hover:bg-red-600/10 flex items-center justify-center"
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
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Number of Pages</label>
                <input
                  type="number"
                  value={editingEvidence.number_of_pages ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value === '' ? null : (isNaN(parseInt(value)) ? null : parseInt(value))
                    setEditingEvidence({ ...editingEvidence, number_of_pages: numValue })
                  }}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date Submitted</label>
                <input
                  type="date"
                  value={editingEvidence.date_submitted ? (typeof editingEvidence.date_submitted === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(editingEvidence.date_submitted) 
                    ? editingEvidence.date_submitted 
                    : new Date(editingEvidence.date_submitted).toISOString().split('T')[0]) : ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, date_submitted: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
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
                <label className="block text-sm font-medium mb-1">Exhibit Number</label>
                <input
                  type="number"
                  value={editingEvidence.exhibit_number || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, exhibit_number: parseInt(e.target.value) || null })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
            </div>
            {/* Description removed per requirements */}
              <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Book-Of-Deeds #</label>
                <input
                  type="text"
                  value={editingEvidence.book_of_deeds_ref || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, book_of_deeds_ref: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  style={{ width: '175px' }}
                />
              </div>
              <button
                type="submit"
                disabled={updateEvidenceMutation.isPending}
                className="px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ 
                  backgroundColor: 'rgba(30, 58, 138, 0.3)',
                  border: '2px solid #10b981',
                  color: '#10b981',
                  width: '175px'
                }}
              >
                {updateEvidenceMutation.isPending ? 'Updating...' : 'Update Evidence'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Evidence Table - Hide when editing */}
      {!editingEvidence && (
        <div className={`card-enhanced w-full mt-12 py-2.5 ${isStatic ? 'min-h-[75vh]' : ''}`} style={{ maxWidth: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="px-6 py-4 border-b border-yellow-400/20 sticky z-40 backdrop-blur-md flex-shrink-0" style={{ backgroundColor: 'rgba(30, 27, 75, 0.3)', top: '60px' }}>
          {/* Row 1: Title, Search boxes, and Buttons */}
          <div className="flex items-center mb-3 w-full">
            <h3 className="text-lg font-semibold text-gold flex-shrink-0 mr-4">Evidence List</h3>
            <div className="flex items-center gap-2 ml-4">
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
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
              {/* Order: Amend, Add, then Show */}
            {!isCollapsed && onSetAmendMode && isInteractive && (
              <button
                onClick={() => onSetAmendMode(!amendMode)}
                className={`px-3 h-8 rounded-lg flex items-center space-x-2 bg-white/10 border border-red-400 text-red-400 hover:opacity-90`}
              >
                <Settings className="w-4 h-4" />
                <span>{amendMode ? 'Exit Amend' : 'Amend'}</span>
              </button>
            )}
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
            {isGuest && !isGuestFrozen && selectedClaim && (
              <button
                onClick={() => setShowCopyModal(true)}
                className="bg-white/10 border border-blue-400 text-blue-400 px-3 h-8 rounded-lg flex items-center space-x-2 hover:opacity-90"
                title="Copy evidence from this shared claim to your own claims"
              >
                <Link className="w-4 h-4" />
                <span>Copy</span>
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
          {/* Row 2: Checkboxes */}
          <div className="flex items-center gap-4 mb-3 w-full" style={{ marginLeft: '0px' }}>
            {/* Column 1: Show/Hide label */}
            <span className="text-sm text-gold flex-shrink-0">Show/Hide</span>
            {/* Column 2 onwards: Checkboxes */}
            <div className="flex items-center gap-4" style={{ marginLeft: '65px' }}>
              <label className="text-sm flex items-center gap-2">
                <input className="w-5 h-5" type="checkbox" checked={columnPrefs.showMethod} onChange={(e) => setColumnPrefs({ ...columnPrefs, showMethod: e.target.checked })} />
                Method
              </label>
              <label className="text-sm flex items-center gap-2">
                <input className="w-5 h-5" type="checkbox" checked={columnPrefs.showPages} onChange={(e) => setColumnPrefs({ ...columnPrefs, showPages: e.target.checked })} />
                Pages
              </label>
              <label className="text-sm flex items-center gap-2">
                <input className="w-5 h-5" type="checkbox" checked={columnPrefs.showBookOfDeeds} onChange={(e) => setColumnPrefs({ ...columnPrefs, showBookOfDeeds: e.target.checked })} />
                Book of deeds
              </label>
              <label className="text-sm flex items-center gap-2">
                <input className="w-5 h-5" type="checkbox" checked={columnPrefs.showCLCRef} onChange={(e) => setColumnPrefs({ ...columnPrefs, showCLCRef: e.target.checked })} />
                CLC reference
              </label>
              <label className="text-sm flex items-center gap-2">
                <input className="w-5 h-5" type="checkbox" checked={columnPrefs.showExhibitNumber} onChange={(e) => setColumnPrefs({ ...columnPrefs, showExhibitNumber: e.target.checked })} />
                Exhibit #
              </label>
            </div>
          </div>
        </div>
        {!isCollapsed && (
          <div className={`flex-1 ${isStatic ? 'max-h-[75vh] overflow-y-auto overflow-x-hidden' : 'overflow-y-auto'} ${!isStatic ? 'overflow-x-auto' : ''}`} style={{ scrollbarGutter: isStatic ? 'stable both-edges' as any : undefined, maxWidth: '1100px' }}>
            <table className={`min-w-full ${isStatic ? 'table-fixed' : 'table-auto'} divide-y divide-yellow-400/20`}>
            <thead className="bg-yellow-400/10">
              <tr>
                {!isGuest && amendMode && (
                  <th className={`px-2 py-3 text-left text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-12' : 'w-10'}`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5"
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
                <th className={`pl-[10px] pr-2 py-3 text-left text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-48' : ''}`}>
                  File Name
                </th>
                {columnPrefs.showMethod && (
                  <th className={`px-2 py-3 text-center text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                    Method
                  </th>
                )}
                {columnPrefs.showPages && (
                  <th className={`px-2 py-3 text-center text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-16' : ''}`}>
                    Pages
                  </th>
                )}
                <th className={`px-2 py-3 text-center text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-24' : ''}`}>
                  Date Submitted
                </th>
                {columnPrefs.showBookOfDeeds && (
                  <th className={`px-2 py-3 text-center text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                    Book of Deeds #
                  </th>
                )}
                {columnPrefs.showCLCRef && (
                  <th className={`px-2 py-3 text-center text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                    CLC Ref #
                  </th>
                )}
                {columnPrefs.showExhibitNumber && (
                  <th className={`px-2 py-3 text-center text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                    Exhibit #
                  </th>
                )}
                <th className={`px-2 py-3 text-center text-sm font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-24' : ''}`}>
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
                      } align-middle ${isStatic ? 'h-16' : 'h-14'}`}
                      onClick={() => (isInteractive ? handleRowClick(item) : undefined)}
                    >
                    {/* Order column hidden as requested */}
                    {!isGuest && amendMode && (
                      <td className={`px-2 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-base text-gray-500`}>
                        <input
                          type="checkbox"
                          className="w-5 h-5"
                          checked={!!selectedIds[item.id]}
                          onChange={(e) => setSelectedIds({ ...selectedIds, [item.id]: e.target.checked })}
                          title="Select for bulk link"
                        />
                      </td>
                    )}
                    <td className={`pl-[10px] pr-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base text-gray-900 text-left`}>
                      {item.title || item.file_name || item.name || '-'}
                    </td>
                    {columnPrefs.showMethod && (
                      <td className={`px-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base text-gray-500 text-center`}>
                        {item.method || '-'}
                      </td>
                    )}
                    {columnPrefs.showPages && (
                      <td className={`px-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base text-gray-500 text-center`}>
                        {item.number_of_pages || '-'}
                      </td>
                    )}
                    <td className={`px-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base text-gray-500 text-center`}>
                      {item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : '-'}
                    </td>
                    {columnPrefs.showBookOfDeeds && (
                      <td className={`px-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base text-gray-500 text-center`}>
                        {item.book_of_deeds_ref || '-'}
                      </td>
                    )}
                    {columnPrefs.showCLCRef && (
                      <td className={`px-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base text-gray-500 text-center`}>
                        {item.book_of_deeds_ref || '-'}
                      </td>
                    )}
                    {columnPrefs.showExhibitNumber && (
                      <td className={`px-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base text-gray-500 text-center`}>
                        {(item as any).exhibit_number || '-'}
                      </td>
                    )}
                    <td className={`px-2 ${isStatic ? 'py-3' : 'py-3'} whitespace-nowrap text-base font-medium text-center`}>
                      <div className="flex justify-center items-center gap-[2px]">
                        {item.file_url && (!isGuest || (guestDownloadAllowed && (linkPermissions[item.id] !== false))) && (
                          <>
                          <button
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(item.file_url as string, '_blank')
                              }}
                            className="text-blue-600 hover:text-blue-900 p-[2px]"
                            title="View file"
                          >
                            <Eye className="w-6 h-6" />
                          </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadFile(item.file_url as string, item.file_name || item.title || 'evidence')
                              }}
                              className="text-green-600 hover:text-green-900 p-[2px]"
                              title="Download file"
                            >
                              <Download className="w-6 h-6" />
                            </button>
                          </>
                        )}
                            {!isGuest && amendMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                              if (window.confirm('Are you sure you want to delete this evidence item? This action cannot be undone.')) {
                                deleteEvidenceMutation.mutate(item.id, {
                                  onSuccess: () => {
                                    toast({
                                      title: "Success",
                                      description: "Evidence deleted successfully!",
                                    })
                                  }
                                })
                              }
                            }}
                            disabled={deleteEvidenceMutation.isPending}
                            className="text-red-600 hover:text-red-900 p-[2px] disabled:opacity-50"
                                title="Delete evidence"
                              >
                            <Trash2 className="w-6 h-6" />
                              </button>
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
                                
                                // Try to update guest_download_allowed, but handle gracefully if column doesn't exist
                                const { error } = await supabase
                                  .from('evidence_claims')
                                  .update({ guest_download_allowed: allowed })
                                  .eq('claim_id', claimId)
                                  .eq('evidence_id', item.id)
                                
                                if (error) {
                                  // If column doesn't exist (400 error), just update local state
                                  if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
                                    console.warn('guest_download_allowed column does not exist in evidence_claims table. Update skipped.')
                                    // Still update local state for UI consistency
                                    setLinkPermissions({ ...linkPermissions, [item.id]: allowed })
                                  } else {
                                    throw error
                                  }
                                } else {
                                  setLinkPermissions({ ...linkPermissions, [item.id]: allowed })
                                }
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
                      </div>
                    </td>
                    </tr>
                    {expandedEvidence === item.id && editingEvidence && (
                      <tr>
                        <td colSpan={
                          (isGuest ? 0 : (amendMode ? 1 : 0)) + 
                          1 + // File Name
                          (columnPrefs.showMethod ? 1 : 0) + 
                          1 + // Date Submitted
                          (columnPrefs.showPages ? 1 : 0) + 
                          (columnPrefs.showBookOfDeeds ? 1 : 0) + 
                          (columnPrefs.showCLCRef ? 1 : 0) + 
                          (columnPrefs.showExhibitNumber ? 1 : 0) + 
                          1 // Actions
                        } className="px-2 py-3 bg-yellow-400/10 border-t">
                          <div className="card-enhanced p-8 border-l-4" style={{ borderLeftColor: claimColor, maxWidth: '100%' }}>
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-xl font-semibold">Edit Evidence</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedEvidence(null)
                                  setEditingEvidence(null)
                                }}
                                className="bg-transparent text-red-600 border border-red-600 p-2 rounded-lg hover:bg-red-600/10 flex items-center justify-center"
                              >
                                <X className="w-6 h-6" />
                              </button>
                            </div>
                            <form onSubmit={handleUpdate} className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-base font-medium mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={editingEvidence.title || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, title: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-3 text-base bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                    placeholder="Enter evidence title"
                                  />
                                </div>
                                <div>
                                  <label className="block text-base font-medium mb-1">Replace File</label>
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
                                      className="w-full border border-yellow-400/30 rounded-lg px-3 py-3 text-base bg-white/10 text-gold file:bg-white/10 file:text-gold file:border-0 file:mr-4 file:py-2 file:px-3 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                    />
                                    <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-yellow-400 pointer-events-none" />
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <label className="block text-base font-medium mb-1">Number of Pages</label>
                                  <input
                                    type="number"
                                    value={editingEvidence.number_of_pages ?? ''}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      const numValue = value === '' ? null : (isNaN(parseInt(value)) ? null : parseInt(value))
                                      setEditingEvidence({ ...editingEvidence, number_of_pages: numValue })
                                    }}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-3 text-base bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                                <div>
                                  <label className="block text-base font-medium mb-1">Date Submitted</label>
                                  <input
                                    type="date"
                                    value={editingEvidence.date_submitted ? (typeof editingEvidence.date_submitted === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(editingEvidence.date_submitted) 
                                      ? editingEvidence.date_submitted 
                                      : new Date(editingEvidence.date_submitted).toISOString().split('T')[0]) : ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, date_submitted: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-3 text-base bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                                <div>
                                  <label className="block text-base font-medium mb-1">Method</label>
                                  <select
                                    value={editingEvidence.method || 'Post'}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, method: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-3 text-base bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  >
                                    <option value="Post">Post</option>
                                    <option value="Email">Email</option>
                                    <option value="Hand">Hand</option>
                                    <option value="Call">Call</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-base font-medium mb-1">Exhibit Number</label>
                                  <input
                                    type="number"
                                    value={editingEvidence.exhibit_number || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, exhibit_number: parseInt(e.target.value) || null })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-3 text-base bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                              </div>
                              {/* Description removed per requirements */}
                              <div className="flex items-end justify-between gap-4">
                                <div>
                                  <label className="block text-base font-medium mb-1">Book-Of-Deeds #</label>
                                  <input
                                    type="text"
                                    value={editingEvidence.book_of_deeds_ref || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, book_of_deeds_ref: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-3 text-base bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                    style={{ width: '175px' }}
                                  />
                                </div>
                                <button
                                  type="submit"
                                  disabled={updateEvidenceMutation.isPending}
                                  className="px-5 py-3 text-base rounded-lg disabled:opacity-50"
                                  style={{ 
                                    backgroundColor: 'rgba(30, 58, 138, 0.3)',
                                    border: '2px solid #10b981',
                                    color: '#10b981',
                                    width: '175px'
                                  }}
                                >
                                  {updateEvidenceMutation.isPending ? 'Updating...' : 'Update Evidence'}
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
                  <td colSpan={
                    (!isGuest && amendMode ? 1 : 0) + 
                    1 + // File Name
                    (columnPrefs.showMethod ? 1 : 0) + 
                    1 + // Date Submitted
                    (columnPrefs.showPages ? 1 : 0) + 
                    (columnPrefs.showBookOfDeeds ? 1 : 0) + 
                    (columnPrefs.showCLCRef ? 1 : 0) + 
                    1 // Actions
                  } className="px-2 py-3 text-center text-gray-500">
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
            // evidenceData is already filtered for the selected claim
            const list = evidenceData || []
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

              // Get the current minimum display_order for this user
              // Since list is sorted descending, new items should have the lowest display_order to appear at the end
              const { data: minOrderData } = await supabase
                .from('evidence')
                .select('display_order')
                .eq('user_id', user.id)
                .not('display_order', 'is', null)
                .order('display_order', { ascending: true })
                .limit(1)
              const minDisplayOrder = minOrderData?.[0]?.display_order ?? 1
              const newDisplayOrder = Math.max(0, minDisplayOrder - 1)

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

              // Refresh evidence list (don't close modal here - let AddEvidenceModal handle it)
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

      {/* Copy Evidence Modal - For Guest Users */}
      {showCopyModal && selectedClaim && isGuest && (
        <CopyEvidenceModal
          open={showCopyModal}
          onOpenChange={setShowCopyModal}
          currentClaimCaseNumber={selectedClaim}
          currentClaimTitle={currentClaimTitle || 'Shared Claim'}
          availableEvidence={evidenceData || []}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['evidence'] })
          }}
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