import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, Link, Calendar, Hash, BookOpen, Eye, Trash2, Edit, Plus, Settings, GripVertical } from 'lucide-react'
import { Evidence } from '@/types/database'

interface EvidenceManagerProps {
  selectedClaim: string | null
  claimColor?: string
}

const EvidenceManager = ({ selectedClaim, claimColor = '#3B82F6' }: EvidenceManagerProps) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [newEvidence, setNewEvidence] = useState({
    file_name: '',
    file_url: '',
    exhibit_id: '',
    number_of_pages: '',
    date_submitted: '',
    method: 'Post' as const,
    url_link: '',
    book_of_deeds_ref: '',
    case_number: ''
  })

  const queryClient = useQueryClient()

  const { data: evidence, isLoading } = useQuery({
    queryKey: ['evidence', selectedClaim],
    queryFn: async () => {
      let query = supabase
        .from('evidence')
        .select('*')
      
      if (selectedClaim) {
        query = query.eq('case_number', selectedClaim)
      }
      
      const { data, error } = await query
        .order('display_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Evidence[]
    }
  })

  const { data: claims } = useQuery({
    queryKey: ['claims-for-evidence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title')
        .order('title')
      
      if (error) throw error
      return data
    }
  })

  const addEvidenceMutation = useMutation({
    mutationFn: async (evidenceData: typeof newEvidence) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const processedData = {
        ...evidenceData,
        user_id: user.id,
        number_of_pages: evidenceData.number_of_pages ? parseInt(evidenceData.number_of_pages) : null,
        case_number: evidenceData.case_number || null
      }

      const { data, error } = await supabase
        .from('evidence')
        .insert([processedData])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      setShowAddForm(false)
      resetForm()
    }
  })

  const updateEvidenceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<Evidence> }) => {
      const processedData = {
        ...data,
        number_of_pages: data.number_of_pages ? parseInt(data.number_of_pages.toString()) : null
      }

      const { data: result, error } = await supabase
        .from('evidence')
        .update(processedData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      setEditingEvidence(null)
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

  const moveEvidenceMutation = useMutation({
    mutationFn: async ({ evidenceList }: { evidenceList: Evidence[] }) => {
      // Update all evidence items with new exhibit_id based on their position
      const updates = evidenceList.map((item, index) => ({
        id: item.id,
        exhibit_id: `${index + 1}`,
        display_order: index + 1
      }))

      // Perform batch update
      const promises = updates.map(update => 
        supabase
          .from('evidence')
          .update({ exhibit_id: update.exhibit_id, display_order: update.display_order })
          .eq('id', update.id)
      )

      const results = await Promise.all(promises)
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
        throw errors[0].error
      }

      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
    }
  })

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedItem || !evidence || draggedItem === targetId) return

    const draggedIndex = evidence.findIndex(item => item.id === draggedItem)
    const targetIndex = evidence.findIndex(item => item.id === targetId)
    
    if (draggedIndex === -1 || targetIndex === -1) return

    // Create new array with reordered items
    const newEvidenceList = [...evidence]
    const [movedItem] = newEvidenceList.splice(draggedIndex, 1)
    newEvidenceList.splice(targetIndex, 0, movedItem)
    
    // Update with new exhibit numbers
    moveEvidenceMutation.mutate({ evidenceList: newEvidenceList })
    setDraggedItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const oldMoveEvidenceMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: string, newOrder: number }) => {
      const { data, error } = await supabase
        .from('evidence')
        .update({ display_order: newOrder })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
    }
  })

  const resetForm = () => {
    setNewEvidence({
      file_name: '',
      file_url: '',
      exhibit_id: '',
      number_of_pages: '',
      date_submitted: '',
      method: 'Post',
      url_link: '',
      book_of_deeds_ref: '',
      case_number: ''
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvidence.file_name.trim()) return
    addEvidenceMutation.mutate(newEvidence)
  }

  const handleEdit = (evidence: Evidence) => {
    setEditingEvidence(evidence)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvidence) return
    updateEvidenceMutation.mutate({
      id: editingEvidence.id,
      data: editingEvidence
    })
  }

  const getMethodIcon = (method?: string) => {
    switch (method) {
      case 'Post': return <FileText className="w-4 h-4" />
      case 'Email': return <FileText className="w-4 h-4" />
      case 'Hand': return <FileText className="w-4 h-4" />
      case 'Call': return <FileText className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading evidence...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Evidence Management</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
              editMode 
                ? 'text-white hover:opacity-90' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            style={editMode ? { backgroundColor: claimColor } : {}}
          >
            <Settings className="w-4 h-4" />
            <span>{editMode ? 'Exit Edit' : 'Edit Mode'}</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-white px-4 py-2 rounded-lg hover:opacity-90 flex items-center space-x-2"
            style={{ backgroundColor: claimColor }}
          >
            <Plus className="w-4 h-4" />
            <span>Add Evidence</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Add New Evidence</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">File Name *</label>
                <input
                  type="text"
                  value={newEvidence.file_name}
                  onChange={(e) => setNewEvidence({ ...newEvidence, file_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File URL</label>
                <input
                  type="url"
                  value={newEvidence.file_url}
                  onChange={(e) => setNewEvidence({ ...newEvidence, file_url: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Exhibit ID</label>
                <input
                  type="text"
                  value={newEvidence.exhibit_id}
                  onChange={(e) => setNewEvidence({ ...newEvidence, exhibit_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number of Pages</label>
                <input
                  type="number"
                  value={newEvidence.number_of_pages}
                  onChange={(e) => setNewEvidence({ ...newEvidence, number_of_pages: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={newEvidence.method}
                  onChange={(e) => setNewEvidence({ ...newEvidence, method: e.target.value as any })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="Post">Post</option>
                  <option value="Email">Email</option>
                  <option value="Hand">Hand</option>
                  <option value="Call">Call</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date Submitted</label>
                <input
                  type="date"
                  value={newEvidence.date_submitted}
                  onChange={(e) => setNewEvidence({ ...newEvidence, date_submitted: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Associated Claim</label>
                <select
                  value={selectedClaim || newEvidence.case_number}
                  onChange={(e) => setNewEvidence({ ...newEvidence, case_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={!!selectedClaim}
                >
                  <option value="">Select a claim...</option>
                  {claims?.map((claim) => (
                    <option key={claim.case_number} value={claim.case_number}>
                      {claim.case_number} - {claim.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL Link</label>
              <input
                type="url"
                value={newEvidence.url_link}
                onChange={(e) => setNewEvidence({ ...newEvidence, url_link: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Book of Deeds Reference</label>
              <input
                type="text"
                value={newEvidence.book_of_deeds_ref}
                onChange={(e) => setNewEvidence({ ...newEvidence, book_of_deeds_ref: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={addEvidenceMutation.isPending}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                {addEvidenceMutation.isPending ? 'Adding...' : 'Add Evidence'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingEvidence && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Edit Evidence</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">File Name *</label>
                <input
                  type="text"
                  value={editingEvidence.file_name || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, file_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Exhibit ID</label>
                <input
                  type="text"
                  value={editingEvidence.exhibit_id || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, exhibit_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={updateEvidenceMutation.isPending}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                {updateEvidenceMutation.isPending ? 'Updating...' : 'Update Evidence'}
              </button>
              <button
                type="button"
                onClick={() => setEditingEvidence(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {evidence?.map((item) => (
          <div 
            key={item.id} 
            className={`bg-white p-6 rounded-lg shadow border-l-4 transition-all ${
              editMode ? 'cursor-move hover:shadow-lg' : ''
            } ${draggedItem === item.id ? 'opacity-50' : ''}`}
            style={{ borderLeftColor: claimColor }}
            draggable={editMode}
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, item.id)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {editMode && (
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  )}
                  {getMethodIcon(item.method)}
                  <h3 className="text-lg font-semibold">{item.file_name}</h3>
                </div>
                <div className="grid grid-cols-5 gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center space-x-1">
                    <Hash className="w-4 h-4" />
                    {item.file_url ? (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold underline hover:opacity-80"
                        style={{ color: claimColor }}
                      >
                        Exhibit {item.exhibit_id || 'N/A'}
                      </a>
                    ) : (
                      <span className="font-bold">Exhibit {item.exhibit_id || 'N/A'}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Pages:</span>
                    <span>{item.number_of_pages || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Method:</span>
                    <span>{item.method || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Bundle:</span>
                    <span>{item.case_number || 'N/A'}</span>
                  </div>
                </div>
                {item.book_of_deeds_ref && (
                  <div className="mt-2 flex items-center space-x-1 text-sm text-gray-600">
                    <BookOpen className="w-4 h-4" />
                    <span>Book of Deeds: {item.book_of_deeds_ref}</span>
                  </div>
                )}
                {item.url_link && (
                  <div className="mt-2">
                    <a
                      href={item.url_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <Link className="w-4 h-4" />
                      <span>View Link</span>
                    </a>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:opacity-80"
                    style={{ color: claimColor }}
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                )}
                {editMode && (
                  <>
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-gray-600 hover:text-gray-800 p-2"
                      title="Edit evidence"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteEvidenceMutation.mutate(item.id)}
                      className="text-red-600 hover:text-red-800 p-2"
                      title="Delete evidence"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {(!evidence || evidence.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            No evidence found. Add your first piece of evidence to get started!
          </div>
        )}
      </div>
    </div>
  )
}

export default EvidenceManager