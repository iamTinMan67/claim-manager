import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PendingEvidence, Claim } from '@/types/database'
import { CheckCircle, XCircle, Clock, FileText, ExternalLink, Calendar, Eye } from 'lucide-react'

interface PendingEvidenceReviewProps {
  selectedClaim?: string
  isOwner: boolean
}

const PendingEvidenceReview: React.FC<PendingEvidenceReviewProps> = ({
  selectedClaim,
  isOwner
}) => {
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedPending, setSelectedPending] = useState<PendingEvidence | null>(null)
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([])
  const [rejectReason, setRejectReason] = useState('')
  const queryClient = useQueryClient()

  // Get pending evidence for the selected claim
  const { data: pendingEvidence, isLoading } = useQuery({
    queryKey: ['pending-evidence', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return []
      
      const { data, error } = await supabase
        .from('pending_evidence')
        .select('*')
        .eq('claim_id', selectedClaim)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })

      if (error) throw error
      return data as PendingEvidence[]
    },
    enabled: !!selectedClaim && isOwner
  })

  // Get all claims for the approve modal
  const { data: allClaims } = useQuery({
    queryKey: ['claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Claim[]
    }
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ pendingId, claimIds }: { pendingId: string, claimIds: string[] }) => {
      const { data, error } = await supabase.rpc('promote_pending_evidence', {
        p_pending_id: pendingId,
        p_claim_ids: claimIds
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-evidence'] })
      queryClient.invalidateQueries({ queryKey: ['evidence'] })
      setShowApproveModal(false)
      setSelectedPending(null)
      setSelectedClaimIds([])
    }
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ pendingId, reason }: { pendingId: string, reason: string }) => {
      const { data, error } = await supabase.rpc('reject_pending_evidence', {
        p_pending_id: pendingId,
        p_reason: reason
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-evidence'] })
      setShowRejectModal(false)
      setSelectedPending(null)
      setRejectReason('')
    }
  })

  const handleApprove = (pending: PendingEvidence) => {
    setSelectedPending(pending)
    setSelectedClaimIds([pending.claim_id])
    setShowApproveModal(true)
  }

  const handleReject = (pending: PendingEvidence) => {
    setSelectedPending(pending)
    setRejectReason('')
    setShowRejectModal(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        )
      default:
        return null
    }
  }

  if (!isOwner || !selectedClaim) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading pending evidence...</div>
      </div>
    )
  }

  if (!pendingEvidence || pendingEvidence.length === 0) {
    return (
      <div className="card-enhanced p-6 text-center">
        <div className="text-gold">No pending evidence for review</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card-enhanced p-4">
        <h3 className="text-lg font-semibold text-gold mb-4">Pending Evidence Review</h3>
        
        {pendingEvidence.map((evidence) => (
          <div key={evidence.id} className="card-smudge p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <div className="space-y-1">
                <h4 className="text-base font-medium text-gold">
                  {evidence.file_name || evidence.description || 'Evidence Item'}
                </h4>
                <p className="text-sm text-gray-300">
                  Submitted: {new Date(evidence.submitted_at).toLocaleDateString()}
                </p>
              </div>
              {getStatusBadge(evidence.status)}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              {evidence.exhibit_id && (
                <div>
                  <span className="font-medium text-gold">Exhibit:</span> 
                  <span className="ml-1 text-white">{evidence.exhibit_id}</span>
                </div>
              )}
              {evidence.method && (
                <div>
                  <span className="font-medium text-gold">Method:</span> 
                  <span className="ml-1 text-white">{evidence.method}</span>
                </div>
              )}
              {evidence.number_of_pages && (
                <div>
                  <span className="font-medium text-gold">Pages:</span> 
                  <span className="ml-1 text-white">{evidence.number_of_pages}</span>
                </div>
              )}
              {evidence.date_submitted && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-gold" />
                  <span className="text-white">{new Date(evidence.date_submitted).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {evidence.description && (
              <div className="mb-4">
                <span className="font-medium text-gold">Description:</span>
                <p className="text-white mt-1">{evidence.description}</p>
              </div>
            )}

            {evidence.file_url && (
              <div className="mb-4">
                <a
                  href={evidence.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-gold hover:text-yellow-300"
                >
                  <Eye className="w-4 h-4" />
                  View File
                </a>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => handleApprove(evidence)}
                disabled={approveMutation.isPending}
                className="btn-gold px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => handleReject(evidence)}
                disabled={rejectMutation.isPending}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-enhanced p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gold mb-4">Approve Evidence</h3>
            <p className="text-white mb-4">
              Link "{selectedPending.file_name || selectedPending.description}" to which claims?
            </p>
            
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
              {allClaims?.map((claim) => (
                <label key={claim.case_number} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedClaimIds.includes(claim.case_number)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClaimIds([...selectedClaimIds, claim.case_number])
                      } else {
                        setSelectedClaimIds(selectedClaimIds.filter(id => id !== claim.case_number))
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-white">{claim.case_number} - {claim.title}</span>
                </label>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => approveMutation.mutate({ 
                  pendingId: selectedPending.id, 
                  claimIds: selectedClaimIds 
                })}
                disabled={approveMutation.isPending || selectedClaimIds.length === 0}
                className="btn-gold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setSelectedPending(null)
                  setSelectedClaimIds([])
                }}
                className="bg-yellow-400/20 text-gold px-4 py-2 rounded-lg hover:bg-yellow-400/30"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-enhanced p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gold mb-4">Reject Evidence</h3>
            <p className="text-white mb-4">
              Why are you rejecting "{selectedPending.file_name || selectedPending.description}"?
            </p>
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full p-3 border border-yellow-400/30 bg-white/10 text-gold rounded-lg focus:border-yellow-400 focus:outline-none"
              rows={3}
            />

            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => rejectMutation.mutate({ 
                  pendingId: selectedPending.id, 
                  reason: rejectReason 
                })}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedPending(null)
                  setRejectReason('')
                }}
                className="bg-yellow-400/20 text-gold px-4 py-2 rounded-lg hover:bg-yellow-400/30"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PendingEvidenceReview
