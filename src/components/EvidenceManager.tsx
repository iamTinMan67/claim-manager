import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, Link, Calendar, Hash, BookOpen, Eye, Trash2, Edit, Plus, Settings, GripVertical } from 'lucide-react'
import { Evidence } from '@/types/database'
import { format } from 'date-fns'

interface EvidenceManagerProps {
  selectedClaim: string | null
  claimColor?: string
}

const EvidenceManager = ({ selectedClaim, claimColor = '#3B82F6' }: EvidenceManagerProps) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [showClaimSwitcher, setShowClaimSwitcher] = useState(false)
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
      console.log('Evidence query - selectedClaim:', selectedClaim)
      
      let query = supabase
        .from('evidence')
        .select('*')
      
      if (selectedClaim) {
        console.log('Filtering by case_number:', selectedClaim)
        query = query.eq('case_number', selectedClaim)
      }
      
      const { data, error } = await query
        .order('display_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: true })
      
      console.log('Evidence query result:', { data, error, count: data?.length })
      
      if (error) throw error
      
      // If selectedClaim is set but no evidence found, get all evidence
      if (selectedClaim && (!data || data.length === 0)) {
        console.log('No evidence found for claim, fetching all evidence')
        const { data: allData, error: allError } = await supabase
          .from('evidence')
          .select('*')
          .order('display_order', { ascending: true, nullsLast: true })
          .order('created_at', { ascending: true })
        
        if (allError) throw allError
        return allData as Evidence[]
      }
      
      // Reverse the order to show in descending order (newest first)
      return (data as Evidence[]).reverse()
    }
  })

  const calculateBundleNumber = (evidenceList: Evidence[], currentIndex: number): number => {
    let bundleNumber = 1
    for (let i = 0; i < currentIndex; i++) {
      const pages = evidenceList[i].number_of_pages || 1
      bundleNumber += pages
    }
    return bundleNumber
  }

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

  // Get evidence counts per claim
  const { data: evidenceCounts } = useQuery({
    queryKey: ['evidence-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence')
        .select('case_number')
      
      if (error) throw error
      
      // Count evidence per claim
      const counts: { [key: string]: number } = {}
      data.forEach(item => {
        const key = item.case_number || 'unassociated'
        counts[key] = (counts[key] || 0) + 1
      })
      
      return counts
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

      // If method is "To-Do" and date_submitted is not empty and >= today, create a todo task
      if (evidenceData.method === 'To-Do' && evidenceData.date_submitted) {
        const submittedDate = new Date(evidenceData.date_submitted)
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison
        
        if (submittedDate >= today) {
          // Create a todo task
          const todoData = {
            user_id: user.id,
            title: `Evidence Task: ${evidenceData.file_name}`,
            description: `Complete evidence task for ${evidenceData.file_name}${evidenceData.case_number ? ` (Case: ${evidenceData.case_number})` : ''}`,
            due_date: `${evidenceData.date_submitted}T09:00:00`, // Set to 9 AM on the date
            priority: 'medium',
            alarm_enabled: true,
            alarm_time: `${evidenceData.date_submitted}T08:00:00`, // Set alarm 1 hour before
            case_number: evidenceData.case_number || null
          }

          const { error: todoError } = await supabase
            .from('todos')
            .insert([todoData])

          if (todoError) {
            console.error('Error creating todo task:', todoError)
            // Don't throw error here as evidence was created successfully
          }
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      queryClient.invalidateQueries({ queryKey: ['todos'] }) // Refresh todos in case a new task was created
      setShowAddForm(false)
      resetForm()
    }
  })

  const updateEvidenceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<Evidence> }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

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

      // If method is "To-Do" and date_submitted is not empty and >= today, create a todo task
      if (data.method === 'To-Do' && data.date_submitted) {
        const submittedDate = new Date(data.date_submitted)
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison
        
        if (submittedDate >= today) {
          // Check if a todo already exists for this evidence
          const { data: existingTodos } = await supabase
            .from('todos')
            .select('id')
            .eq('title', `Evidence Task: ${data.file_name || result.file_name}`)
            .eq('user_id', user.id)

          if (!existingTodos || existingTodos.length === 0) {
            // Create a todo task
            const todoData = {
              user_id: user.id,
              title: `Evidence Task: ${data.file_name || result.file_name}`,
              description: `Complete evidence task for ${data.file_name || result.file_name}${data.case_number ? ` (Case: ${data.case_number})` : ''}`,
              due_date: `${data.date_submitted}T09:00:00`, // Set to 9 AM on the date
              priority: 'medium',
              alarm_enabled: true,
              alarm_time: `${data.date_submitted}T08:00:00`, // Set alarm 1 hour before
              case_number: data.case_number || result.case_number || null
            }

            const { error: todoError } = await supabase
              .from('todos')
              .insert([todoData])

            if (todoError) {
              console.error('Error creating todo task:', todoError)
              // Don't throw error here as evidence was updated successfully
            }
          }
        }
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      queryClient.invalidateQueries({ queryKey: ['todos'] }) // Refresh todos in case a new task was created
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
      // Update all evidence items with new exhibit_id and display_order based on their position
      // Since we're showing in descending order, we need to reverse the numbering
      const updates = evidenceList.map((item, index) => {
        const newExhibitNumber = evidenceList.length - index
        return {
          id: item.id,
          exhibit_id: `${newExhibitNumber}`,
          display_order: newExhibitNumber
        }
      })

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

  const associateEvidenceMutation = useMutation({
    mutationFn: async ({ evidenceId, caseNumber }: { evidenceId: string, caseNumber: string }) => {
      const { data, error } = await supabase
        .from('evidence')
        .update({ case_number: caseNumber })
        .eq('id', evidenceId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
    }
  })

  const associateAllEvidenceMutation = useMutation({
    mutationFn: async ({ caseNumber }: { caseNumber: string }) => {
      // Get all evidence items that are not associated with any claim
      const unassociatedEvidence = evidence?.filter(item => !item.case_number) || []
      
      if (unassociatedEvidence.length === 0) return []

      // Update all unassociated evidence to be associated with the current claim
      const updates = unassociatedEvidence.map(item => 
        supabase
          .from('evidence')
          .update({ case_number: caseNumber })
          .eq('id', item.id)
      )

      const results = await Promise.all(updates)
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

  const handleAssociateWithClaim = (evidenceId: string) => {
    if (selectedClaim) {
      associateEvidenceMutation.mutate({ 
        evidenceId, 
        caseNumber: selectedClaim 
      })
    }
  }

  const handleAssociateAllWithClaim = () => {
    if (selectedClaim) {
      associateAllEvidenceMutation.mutate({ 
        caseNumber: selectedClaim 
      })
    }
  }

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
      case 'To-Do': return <FileText className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading evidence...</div>
  }

  return (
    <div className="space-y-6">
      {/* Claim Evidence Summary */}
      {evidenceCounts && Object.keys(evidenceCounts).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-blue-900">Evidence Distribution by Claim</h3>
            <button
              onClick={() => setShowClaimSwitcher(!showClaimSwitcher)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {showClaimSwitcher ? 'Hide' : 'Show'} Details
            </button>
          </div>
          {showClaimSwitcher && (
            <div className="space-y-2">
              {Object.entries(evidenceCounts).map(([caseNumber, count]) => {
                const claimInfo = claims?.find(c => c.case_number === caseNumber)
                const isCurrentClaim = caseNumber === selectedClaim
                
                return (
                  <div
                    key={caseNumber}
                    className={`flex justify-between items-center p-2 rounded ${
                      isCurrentClaim ? 'bg-blue-100 border border-blue-300' : 'bg-white'
                    }`}
                  >
                    <div>
                      <span className="font-medium">
                        {caseNumber === 'unassociated' ? 'Unassociated Evidence' : caseNumber}
                      </span>
                      {claimInfo && (
                        <span className="text-sm text-gray-600 ml-2">- {claimInfo.title}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {count} items
                      </span>
                      {caseNumber !== 'unassociated' && caseNumber !== selectedClaim && (
                        <span className="text-xs text-orange-600 font-medium">
                          Switch to this claim to view
                        </span>
                      )}
                      {isCurrentClaim && (
                        <span className="text-xs text-green-600 font-medium">
                          Currently viewing
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Show banner if there are unassociated evidence items when a claim is selected */}
      {selectedClaim && evidence && evidence.some(item => !item.case_number) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-yellow-800 font-medium">
              {evidence.filter(item => !item.case_number).length} evidence items are not associated with any claim.
            </p>
            <p className="text-yellow-700 text-sm mt-1">
              You can associate them individually or all at once with the current claim.
            </p>
          </div>
          <button
            onClick={handleAssociateAllWithClaim}
            disabled={associateAllEvidenceMutation.isPending}
            className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center space-x-2"
            style={{ backgroundColor: claimColor }}
          >
            <span>
              {associateAllEvidenceMutation.isPending 
                ? 'Associating All...' 
                : `Associate All with ${selectedClaim}`
              }
            </span>
          </button>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Evidence Management</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
              editMode 
                ? 'text-red-600 bg-red-100 hover:bg-red-200' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Settings className={`w-4 h-4 ${editMode ? 'text-red-600' : ''}`} />
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
                  <option value="To-Do">To-Do</option>
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
        {evidence && evidence.length > 0 ? evidence.map((item, index) => (
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
                    <span className="font-medium">Bundle #:</span>
                    <span>{calculateBundleNumber(evidence, index)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Method:</span>
                    <span>{item.method || 'N/A'}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center space-x-1 text-sm text-gray-600">
                  <span className="font-medium">Case:</span>
                  <span className={item.case_number ? '' : 'text-red-600 font-medium'}>
                    {item.case_number || 'Not Associated'}
                  </span>
                  {selectedClaim && !item.case_number && (
                    <button
                      onClick={() => handleAssociateWithClaim(item.id)}
                      disabled={associateEvidenceMutation.isPending}
                      className="ml-2 text-xs px-2 py-1 rounded text-white hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: claimColor }}
                    >
                      Associate with {selectedClaim}
                    </button>
                  )}
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
        )) : (
          <div className="text-center py-8 text-gray-500">
            {isLoading ? 'Loading evidence...' : 'No evidence found. Add your first piece of evidence to get started!'}
          </div>
        )}
      </div>
    </div>
  )
}

export default EvidenceManager