import React from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Claim } from '@/types/database'
import { Edit, Trash2, Plus, X } from 'lucide-react'

interface ClaimsTableProps {
  onClaimSelect: (claimId: string | null) => void
  selectedClaim: string | null
}

const ClaimsTable = ({ onClaimSelect, selectedClaim }: ClaimsTableProps) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null)
  const [newClaim, setNewClaim] = useState({
    case_number: '',
    title: '',
    court: '',
    plaintiff_name: '',
    defendant_name: '',
    description: '',
    status: 'Active'
  })

  const queryClient = useQueryClient()

  const { data: claims, isLoading, error } = useQuery({
    queryKey: ['claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Claim[]
    }
  })

  const addClaimMutation = useMutation({
    mutationFn: async (claimData: typeof newClaim) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('claims')
        .insert([{ ...claimData, user_id: user.id }])
        .select()
        .single()

      if (error) throw error
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
        status: 'Active'
      })
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
    if (!newClaim.case_number.trim() || !newClaim.title.trim()) return
    addClaimMutation.mutate(newClaim)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClaim) return
    updateClaimMutation.mutate({
      case_number: editingClaim.case_number,
      data: editingClaim
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading claims...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error loading claims: {error.message}</div>
      </div>
    )
  }

  if (!claims || claims.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-gray-600">No claims found</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Claims</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Claim</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Add New Claim</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Case Number *</label>
                <input
                  type="text"
                  value={newClaim.case_number}
                  onChange={(e) => setNewClaim({ ...newClaim, case_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={newClaim.title}
                  onChange={(e) => setNewClaim({ ...newClaim, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Court</label>
                <input
                  type="text"
                  value={newClaim.court}
                  onChange={(e) => setNewClaim({ ...newClaim, court: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plaintiff</label>
                <input
                  type="text"
                  value={newClaim.plaintiff_name}
                  onChange={(e) => setNewClaim({ ...newClaim, plaintiff_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Defendant</label>
                <input
                  type="text"
                  value={newClaim.defendant_name}
                  onChange={(e) => setNewClaim({ ...newClaim, defendant_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newClaim.description}
                onChange={(e) => setNewClaim({ ...newClaim, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={addClaimMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addClaimMutation.isPending ? 'Adding...' : 'Add Claim'}
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

      {editingClaim && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Edit Claim</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Case Number *</label>
                <input
                  type="text"
                  value={editingClaim.case_number}
                  onChange={(e) => setEditingClaim({ ...editingClaim, case_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={editingClaim.title}
                  onChange={(e) => setEditingClaim({ ...editingClaim, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Court</label>
                <input
                  type="text"
                  value={editingClaim.court || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, court: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plaintiff</label>
                <input
                  type="text"
                  value={editingClaim.plaintiff_name || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, plaintiff_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Defendant</label>
                <input
                  type="text"
                  value={editingClaim.defendant_name || ''}
                  onChange={(e) => setEditingClaim({ ...editingClaim, defendant_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editingClaim.description || ''}
                onChange={(e) => setEditingClaim({ ...editingClaim, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={updateClaimMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {updateClaimMutation.isPending ? 'Updating...' : 'Update Claim'}
              </button>
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedClaim && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex justify-between items-center">
            <span className="text-blue-800 font-medium">
              Currently viewing: {claims?.find(c => c.case_number === selectedClaim)?.title}
            </span>
            <button
              onClick={() => onClaimSelect(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Court
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {claims.map((claim) => (
              <tr 
                key={claim.case_number} 
                className={`hover:bg-gray-50 cursor-pointer ${
                  selectedClaim === claim.case_number ? 'bg-blue-50' : ''
                }`}
                onClick={() => onClaimSelect(claim.case_number)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {claim.case_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {claim.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {claim.court || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    claim.status === 'Active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {claim.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(claim.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingClaim(claim)
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteClaimMutation.mutate(claim.case_number)
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ClaimsTable