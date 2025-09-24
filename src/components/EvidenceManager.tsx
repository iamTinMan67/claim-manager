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
  const isInteractive = !isStatic && (!isGuest || guestCanEdit)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)

  // Persist collapsed state per-claim (by case_number)
  useEffect(() => {
    try {
      if (!selectedClaim) return
      const stored = localStorage.getItem(`evidence_collapsed_${selectedClaim}`)
      if (stored === '0') setIsCollapsed(false)
      if (stored === '1') setIsCollapsed(true)
    } catch {}
  }, [selectedClaim])

  useEffect(() => {
    try {
      if (!selectedClaim) return
      localStorage.setItem(`evidence_collapsed_${selectedClaim}` , isCollapsed ? '1' : '0')
    } catch {}
  }, [isCollapsed, selectedClaim])

  const queryClient = useQueryClient()

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

      // First, get the claim_id from the case_number
      console.log('EvidenceManager: Getting claim_id for case_number:', selectedClaim)
      const claimId = await getClaimIdFromCaseNumber(selectedClaim)
      
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

      // No legacy case_number query needed - evidence is only linked via evidence_claims table
      const byLegacyPromise = Promise.resolve({ data: [] as any[], error: null } as any)

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
      
      // Optional: filter out rows with no meaningful identifier (neither file_name nor file_url)
      merged = merged.filter((e: any) => (e.file_name && e.file_name.length) || (e.file_url && e.file_url.length))
      
      console.log('EvidenceManager: After filtering:', merged.length, 'items')

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
      {/* Pending Evidence Review - hide when collaboration hub is active */}
      {isGuest && selectedClaim && currentUserId && !hidePendingReview && (
        <PendingEvidenceReview 
          selectedClaim={selectedClaim} 
          isOwner={true} 
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
            {/* Order: Add, Amend, Link, then Show. Hide first three while collapsed */}
            {!isCollapsed && isInteractive && (!isGuest || (isGuest && !isGuestFrozen)) && (
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
            {!isCollapsed && isInteractive && (!isGuest || (isGuest && !isGuestFrozen)) && (
              <button
                onClick={() => {
                  if (!selectedClaim) {
                    alert('Please select a claim before linking evidence. The Case Number is required.')
                    return
                  }
                  setShowLinkModal(true)
                }}
                disabled={!selectedClaim}
                className="bg-white/10 border border-white text-white px-3 h-8 rounded-lg flex items-center space-x-2 hover:opacity-90"
              >
                <Link className="w-4 h-4" />
                <span>Link</span>
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
        {!isCollapsed && (
          <div className={`${isStatic ? 'max-h-[75vh] overflow-y-auto overflow-x-hidden' : ''} ${!isStatic ? 'overflow-x-auto' : ''}`} style={{ scrollbarGutter: isStatic ? 'stable both-edges' as any : undefined }}>
            <table className={`min-w-full ${isStatic ? 'table-fixed' : 'table-auto'} divide-y divide-yellow-400/20`}>
            <thead className="bg-yellow-400/10">
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-16' : 'w-12'}`}>
                  Order
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-48' : ''}`}>
                  File Name
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                  Method
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-16' : ''}`}>
                  Pages
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-24' : ''}`}>
                  Date Submitted
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-20' : ''}`}>
                  Exhibit #
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider ${isStatic ? 'w-24' : ''}`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="card-enhanced divide-y divide-gray-200">
              {evidenceData && evidenceData.length > 0 ? (
                evidenceData.map((item) => (
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
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                      {amendMode && !isGuest ? (
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                          <span>{item.display_order || '-'}</span>
                        </div>
                      ) : (
                        <span>{item.display_order || '-'}</span>
                      )}
                    </td>
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-900`}>
                      {item.title || item.file_name || item.name || '-'}
                    </td>
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                      {item.method || '-'}
                    </td>
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                      {item.number_of_pages || '-'}
                    </td>
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                      {item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : '-'}
                    </td>
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm text-gray-500`}>
                      {item.exhibit_number || '-'}
                    </td>
                    <td className={`px-6 ${isStatic ? 'py-3' : 'py-4'} whitespace-nowrap text-sm font-medium`}>
                      <div className="flex space-x-2">
                        {item.file_url && (
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
                            {!isGuest && (
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
                        {/* Removed duplicate delete button - now handled above */}
                      </div>
                    </td>
                    </tr>
                    {expandedEvidence === item.id && editingEvidence && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-yellow-400/10 border-t">
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
              const fromId = (e.exhibit_id || '').match(/(\d+)/)?.[1]
              const fromNum = (e as any).exhibit_number
              const a = fromId ? parseInt(fromId,10) : 0
              const b = typeof fromNum === 'number' ? fromNum : 0
              return Math.max(a,b)
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

              // Clean the data before submission
              const cleanData = {
                ...evidence,
                user_id: user.id,
                display_order: newDisplayOrder,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }

              console.log('EvidenceManager: Inserting evidence with data:', cleanData)
              console.log('EvidenceManager: User ID:', user.id)
              console.log('EvidenceManager: Auth UID check:', await supabase.auth.getUser())

              const { data: insertedEvidence, error } = await supabase
                .from('evidence')
                .insert([cleanData])
                .select()
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
          availableEvidence={[]} // TODO: Fetch available evidence from other claims
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