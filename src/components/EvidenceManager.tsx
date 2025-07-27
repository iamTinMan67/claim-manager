import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, Link, Calendar, Hash, BookOpen, Eye, Trash2, Edit, Plus } from 'lucide-react'
import { Evidence } from '@/types/database'

const EvidenceManager = () => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
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
    queryKey: ['evidence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence')
        .select('*')
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
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Evidence</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
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
                  value={newEvidence.case_number}
                  onChange={(e) => setNewEvidence({ ...newEvidence, case_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
        <div className="bg-white p-6 rounded-lg shadow border">
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
          <div key={item.id} className="bg-white p-6 rounded-lg shadow border">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {getMethodIcon(item.method)}
                  <h3 className="text-lg font-semibold">{item.file_name}</h3>
                  {item.exhibit_id && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                      Exhibit: {item.exhibit_id}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  {item.method && (
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">Method:</span>
                      <span>{item.method}</span>
                    </div>
                  )}
                  {item.number_of_pages && (
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">Pages:</span>
                      <span>{item.number_of_pages}</span>
                    </div>
                  )}
                  {item.date_submitted && (
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(item.date_submitted).toLocaleDateString()}</span>
                    </div>
                  )}
                  {item.case_number && (
                    <div className="flex items-center space-x-1">
                      <Hash className="w-4 h-4" />
                      <span>{item.case_number}</span>
                    </div>
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
              <div className="flex space-x-2">
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 p-2"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handleEdit(item)}
                  className="text-gray-600 hover:text-gray-800 p-2"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteEvidenceMutation.mutate(item.id)}
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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