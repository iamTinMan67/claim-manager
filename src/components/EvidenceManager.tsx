import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Evidence } from '@/types/database'
import { Plus, Edit, Trash2, Upload, Download, Eye, X, Save, Settings, FileText, Calendar, Hash } from 'lucide-react'

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const [newEvidence, setNewEvidence] = useState({
    file_name: '',
    file_url: '',
    exhibit_id: '',
    number_of_pages: '',
    date_submitted: '',
    method: 'Todo',
    url_link: '',
    book_of_deeds_ref: '',
    case_number: selectedClaim || ''
  })
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const queryClient = useQueryClient()

  // Get evidence data
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
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Evidence[]
    }
  })

  // Auto-populate exhibit ID when adding new evidence
  useEffect(() => {
    if (showAddForm && evidenceData) {
      const getNextExhibitId = () => {
        if (!evidenceData || evidenceData.length === 0) {
          return 'Exhibit 1'
        }
        
        // Extract numbers from existing exhibit IDs
        const exhibitNumbers = evidenceData
          .map(item => item.exhibit_id)
          .filter(id => id && id.toLowerCase().includes('exhibit'))
          .map(id => {
            const match = id.match(/exhibit\s*(\d+)/i)
            return match ? parseInt(match[1], 10) : 0
          })
          .filter(num => !isNaN(num))
        
        if (exhibitNumbers.length === 0) {
          return 'Exhibit 1'
        }
        
        const maxNumber = Math.max(...exhibitNumbers)
        return `Exhibit ${maxNumber + 1}`
      }

      setNewEvidence(prev => ({
        ...prev,
        exhibit_id: getNextExhibitId(),
        method: 'Todo',
        case_number: selectedClaim || ''
      }))
    }
  }, [showAddForm, evidenceData, selectedClaim])

  const addEvidenceMutation = useMutation({
    mutationFn: async (evidenceData: typeof newEvidence) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Clean the data before submission
      const cleanData = {
        ...evidenceData,
        user_id: user.id,
        case_number: evidenceData.case_number || null,
        number_of_pages: evidenceData.number_of_pages ? parseInt(evidenceData.number_of_pages) : null,
        date_submitted: evidenceData.date_submitted || null
      }

      const { data, error } = await supabase
        .from('evidence')
        .insert([cleanData])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      setShowAddForm(false)
      setNewEvidence({
        file_name: '',
        file_url: '',
        exhibit_id: '',
        number_of_pages: '',
        date_submitted: '',
        method: 'Post',
        url_link: '',
        book_of_deeds_ref: '',
        case_number: selectedClaim || ''
      })
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

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return
    
    setUploadingFile(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidence-files')
        .upload(fileName, file)

      if (uploadError) {
        // If bucket doesn't exist, create it and try again
        if (uploadError.message.includes('Bucket not found')) {
          console.log('Creating evidence-files bucket...')
          // For now, just use a URL.createObjectURL as fallback
          const fileUrl = URL.createObjectURL(file)
          setNewEvidence(prev => ({
            ...prev,
            file_name: file.name,
            file_url: fileUrl,
            method: 'To-Do'
          }))
        } else {
          throw uploadError
        }
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('evidence-files')
          .getPublicUrl(uploadData.path)

        setNewEvidence(prev => ({
          ...prev,
          file_name: file.name,
          file_url: publicUrl,
          method: 'To-Do'
        }))
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Error uploading file. Please try again.')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvidence.file_name.trim() && !newEvidence.url_link.trim()) return
    addEvidenceMutation.mutate(newEvidence)
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error loading evidence: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Evidence Management</h2>
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
          {(!isGuest || !isGuestFrozen) && (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-white px-4 py-2 rounded-lg hover:opacity-90 flex items-center space-x-2"
              style={{ backgroundColor: claimColor }}
            >
              <Plus className="w-4 h-4" />
              <span>Add Evidence</span>
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

      {showAddForm && (!isGuest || !isGuestFrozen) && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Add New Evidence</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Upload File</h4>
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.wav"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploadingFile ? 'Uploading...' : 'Choose File'}</span>
                </button>
                {newEvidence.file_name && (
                  <span className="text-sm text-green-600">
                    ✓ {newEvidence.file_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Supported: PDF, DOC, DOCX, TXT, JPG, PNG, GIF, MP4, MP3, WAV
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">File Name</label>
                <input
                  type="text"
                  value={newEvidence.file_name}
                  onChange={(e) => setNewEvidence({ ...newEvidence, file_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
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
                  className="w-full border rounded-lg px-3 py-2 bg-blue-50"
                  placeholder="Auto-generated"
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
                <label className="block text-sm font-medium mb-1">Date Submitted</label>
                <input
                  type="date"
                  value={newEvidence.date_submitted}
                  onChange={(e) => setNewEvidence({ ...newEvidence, date_submitted: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={newEvidence.method}
                  onChange={(e) => setNewEvidence({ ...newEvidence, method: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
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
                  value={newEvidence.url_link}
                  onChange={(e) => setNewEvidence({ ...newEvidence, url_link: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CLC Ref#</label>
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
                <label className="block text-sm font-medium mb-1">File Name</label>
                <input
                  type="text"
                  value={editingEvidence.file_name || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, file_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File URL</label>
                <input
                  type="url"
                  value={editingEvidence.file_url || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, file_url: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Exhibit ID</label>
                <input
                  type="text"
                  value={editingEvidence.exhibit_id || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, exhibit_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number of Pages</label>
                <input
                  type="number"
                  value={editingEvidence.number_of_pages || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, number_of_pages: parseInt(e.target.value) || null })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date Submitted</label>
                <input
                  type="date"
                  value={editingEvidence.date_submitted || ''}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, date_submitted: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={editingEvidence.method || 'Todo'}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, method: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
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
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CLC Ref#</label>
              <input
                type="text"
                value={editingEvidence.book_of_deeds_ref || ''}
                onChange={(e) => setEditingEvidence({ ...editingEvidence, book_of_deeds_ref: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Evidence List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Exhibit ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {evidenceData && evidenceData.length > 0 ? (
                evidenceData.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr 
                      className={`hover:bg-gray-50 ${amendMode ? 'cursor-pointer' : ''} ${
                        expandedEvidence === item.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleRowClick(item)}
                    >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.file_name || '-'}
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
                      {item.exhibit_id || '-'}
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
                        {amendMode && (!isGuest || !isGuestFrozen) && (
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
                        <td colSpan={6} className="px-6 py-4 bg-gray-50 border-t">
                          <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
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
                                  <label className="block text-sm font-medium mb-1">File Name</label>
                                  <input
                                    type="text"
                                    value={editingEvidence.file_name || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, file_name: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">File URL</label>
                                  <input
                                    type="url"
                                    value={editingEvidence.file_url || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, file_url: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Exhibit ID</label>
                                  <input
                                    type="text"
                                    value={editingEvidence.exhibit_id || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, exhibit_id: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Number of Pages</label>
                                  <input
                                    type="number"
                                    value={editingEvidence.number_of_pages || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, number_of_pages: parseInt(e.target.value) || null })}
                                    className="w-full border rounded-lg px-3 py-2"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Date Submitted</label>
                                  <input
                                    type="date"
                                    value={editingEvidence.date_submitted || ''}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, date_submitted: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Method</label>
                                  <select
                                    value={editingEvidence.method || 'To-Do'}
                                    onChange={(e) => setEditingEvidence({ ...editingEvidence, method: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
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
                                    className="w-full border rounded-lg px-3 py-2"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">CLC Ref#</label>
                                <input
                                  type="text"
                                  value={editingEvidence.book_of_deeds_ref || ''}
                                  onChange={(e) => setEditingEvidence({ ...editingEvidence, book_of_deeds_ref: e.target.value })}
                                  className="w-full border rounded-lg px-3 py-2"
                                />
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
                                  onClick={() => {
                                    setExpandedEvidence(null)
                                    setEditingEvidence(null)
                                  }}
                                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
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
      </div>
    </div>
  )
}

export default EvidenceManager