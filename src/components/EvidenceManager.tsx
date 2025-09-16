import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Evidence } from '@/types/database'
import { Plus, Edit, Trash2, Upload, Download, Eye, X, Save, Settings, FileText, Calendar, Hash, GripVertical } from 'lucide-react'
import PendingEvidenceReview from './PendingEvidenceReview'
import { AddEvidenceModal } from './AddEvidenceModal'
import { toast } from '@/hooks/use-toast'

interface EvidenceManagerProps {
  selectedClaim: string | null
  claimColor?: string
  amendMode?: boolean
  isGuest?: boolean
  currentUserId?: string
  isGuestFrozen?: boolean
  onEditClaim?: () => void
  onDeleteClaim?: () => void
  onSetAmendMode?: (mode: boolean) => void
}

const EvidenceManager = ({ 
  selectedClaim, 
  claimColor = '#3B82F6', 
  amendMode = false,
  isGuest = false,
  currentUserId,
  isGuestFrozen = false,
  onEditClaim,
  onDeleteClaim,
  onSetAmendMode
}: EvidenceManagerProps) => {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // Get evidence data from evidence table (use original richer records)
  const { data: evidenceData, isLoading, error } = useQuery({
    queryKey: ['evidence', selectedClaim],
    queryFn: async () => {
      let query = supabase
        .from('evidence')
        .select('*')

      if (selectedClaim) {
        query = query.eq('case_number', selectedClaim)
      }

      const { data, error } = await query
        .order('display_order', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Evidence[]
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

      // Clean the data before submission
      const cleanData = {
        ...data,
        number_of_pages: data.number_of_pages ? parseInt(String(data.number_of_pages)) : null,
        date_submitted: data.date_submitted || null
      }

      const { data: result, error } = await supabase
        .from('evidence')
        .update(cleanData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
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
      {/* Pending Evidence Review - Only show for hosts/claim owners */}
      {!isGuest && selectedClaim && currentUserId && (
        <PendingEvidenceReview 
          selectedClaim={selectedClaim} 
          isOwner={true} 
        />
      )}
      
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {onSetAmendMode && (
            <button
              onClick={() => onSetAmendMode(!amendMode)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                amendMode 
                  ? 'bg-orange-600 text-white hover:bg-orange-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>{amendMode ? 'Exit Amend Mode' : 'Amend Mode'}</span>
            </button>
          )}
          {(!isGuest || (isGuest && !isGuestFrozen)) && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2"
              style={{ backgroundColor: claimColor }}
            >
              <Plus className="w-4 h-4" />
              <span>{isGuest ? 'Submit Evidence for Review' : 'Add Evidence'}</span>
            </button>
          )}
          {isGuest && isGuestFrozen && (
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-lg text-sm">
              Access Frozen
            </div>
          )}
          {isGuest && !isGuestFrozen && (
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-lg text-sm">
              Guest Access - Can Add/Edit Own Content
            </div>
          )}
        </div>
      </div>


      {editingEvidence && (
        <div className="card-enhanced p-6 border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Edit Evidence</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Evidence Name</label>
                <input
                  type="text"
                  value={editingEvidence.name || editingEvidence.file_name || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, name: e.target.value, file_name: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File URL</label>
                <input
                  type="url"
                  value={editingEvidence.file_url || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, file_url: e.target.value })}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
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
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editingEvidence.description || ''}
                onChange={(e) => setEditingEvidence({ ...editingEvidence, description: e.target.value })}
                className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                rows={3}
              />
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
            <div className="flex space-x-3 mb-4">
              <button
                type="submit"
                disabled={updateEvidenceMutation.isPending}
                className="btn-gold px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
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
        <div className="card-enhanced overflow-hidden mt-12">
        <div className="px-6 py-4 border-b border-yellow-400/20">
          <h3 className="text-lg font-semibold text-gold">Evidence List</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-yellow-400/20">
            <thead className="bg-yellow-400/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider w-12">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider">
                  Date Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider">
                  Exhibit #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gold-light uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="card-enhanced divide-y divide-gray-200">
              {evidenceData && evidenceData.length > 0 ? (
                evidenceData.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr 
                      draggable={amendMode && !isGuest}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, item.id)}
                      onDragEnd={handleDragEnd}
                      className={`hover:bg-yellow-400/10 ${amendMode ? 'cursor-pointer' : ''} ${
                        expandedEvidence === item.id ? 'bg-yellow-400/20' : ''
                      } ${dragOverItem === item.id ? 'border-t-2 border-blue-500' : ''} ${
                        draggedItem === item.id ? 'opacity-50' : ''
                      }`}
                      onClick={() => !isGuest ? handleRowClick(item) : undefined}
                    >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {amendMode && !isGuest ? (
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                          <span>{item.display_order || '-'}</span>
                        </div>
                      ) : (
                        <span>{item.display_order || '-'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.file_name || item.title || item.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.method || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.number_of_pages || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.exhibit_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {item.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {item.file_url && (
                          <button
                            onClick={() => window.open(item.file_url, '_blank')}
                            className="text-blue-600 hover:text-blue-900"
                            title="View file"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {amendMode && !isGuest && (
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
                      </div>
                    </td>
                    </tr>
                    {expandedEvidence === item.id && editingEvidence && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-yellow-400/10 border-t">
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
                                  <label className="block text-sm font-medium mb-1">Evidence Name</label>
                                  <input
                                    type="text"
                                    value={editingEvidence.name || editingEvidence.file_name || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, name: e.target.value, file_name: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">File URL</label>
                                  <input
                                    type="url"
                                    value={editingEvidence.file_url || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, file_url: e.target.value })}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-sm font-medium mb-1">Replace File</label>
                                  <input
                                    type="file"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0]
                                      if (!file || !editingEvidence) return
                                      // Upload new file using storage bucket
                                      const fileExt = file.name.split('.').pop()
                                      const filePath = `${editingEvidence.user_id || 'user'}/${Date.now()}.${fileExt}`
                                      const { data: up, error: upErr } = await supabase.storage.from('evidence-files').upload(filePath, file)
                                      if (upErr) {
                                        console.error('Upload error:', upErr)
                                        return
                                      }
                                      const { data: { publicUrl } } = supabase.storage.from('evidence-files').getPublicUrl(filePath)
                                      setEditingEvidence({ ...editingEvidence, file_url: publicUrl, file_name: file.name })
                                    }}
                                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold file:bg-white/10 file:text-gold file:border-0 file:mr-4 file:py-1 file:px-2"
                                  />
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
                                  className="btn-gold px-4 py-2 rounded-lg disabled:opacity-50"
                                  style={{ backgroundColor: claimColor }}
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
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No evidence found. Add some evidence to get started!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

              // Get the current maximum display_order for this claim
              let query = supabase
                .from('evidence')
                .select('display_order')
                .eq('user_id', user.id)
                .not('display_order', 'is', null)
                .order('display_order', { ascending: false })
                .limit(1)
              
              if (selectedClaim) {
                query = query.eq('case_number', selectedClaim)
              }
              
              const { data: maxOrderData } = await query
              const maxDisplayOrder = maxOrderData?.[0]?.display_order || 0
              const newDisplayOrder = maxDisplayOrder + 1

              // Clean the data before submission
              const cleanData = {
                ...evidence,
                user_id: user.id,
                case_number: selectedClaim || null,
                display_order: newDisplayOrder,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }

              const { error } = await supabase
                .from('evidence')
                .insert([cleanData])

              if (error) throw error

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
    </div>
  )
}

export default EvidenceManager