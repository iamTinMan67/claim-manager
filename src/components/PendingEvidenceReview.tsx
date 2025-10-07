import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PendingEvidence, Claim } from '@/types/database'
import { CheckCircle, XCircle, Clock, FileText, ExternalLink, Calendar, Eye, Trash } from 'lucide-react'
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils'

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
      
      const claimId = await getClaimIdFromCaseNumber(selectedClaim)
      if (!claimId) return []
      
      const { data, error } = await supabase
        .from('pending_evidence')
        .select('*')
        .eq('claim_id', claimId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })

      if (error) throw error
      return data as PendingEvidence[]
    },
    enabled: !!selectedClaim
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

  if (!selectedClaim) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading pending evidence...</div>
      </div>
    )
  }

  if (!pendingEvidence || pendingEvidence.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="card-enhanced p-4">
        <h3 className="text-lg font-semibold text-gold mb-4">Pending Evidence Review</h3>
        
        {pendingEvidence.map((evidence) => (
          <div key={evidence.id} className="card-smudge p-3 mb-3">
            <div className="flex justify-between items-start mb-2">
              <div className="space-y-1 w-full">
                <h4 className="text-base font-medium text-gold">
                  {evidence.title || evidence.description || 'Evidence Item'}
                </h4>
                {/* Single row with labels over values; Description first */}
                <div className="grid grid-cols-4 gap-3 text-sm items-start">
                  <div>
                    <div className="text-gold">Description</div>
                    <div className="text-white mt-0.5 leading-snug">{evidence.description || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gold">Submitted</div>
                    <div className="text-white leading-snug">{new Date(evidence.submitted_at).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-gold">Method</div>
                    <div className="text-white leading-snug">{evidence.method || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gold flex items-center gap-1"><Calendar className="w-4 h-4" /> Date</div>
                    <div className="text-white leading-snug">{evidence.date_submitted ? new Date(evidence.date_submitted).toLocaleDateString() : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="pt-1">{getStatusBadge(evidence.status)}</div>
                {/* Align icons to badge's right edge */}
                {evidence.file_url && (
                  <a
                    href={evidence.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:text-yellow-300"
                    title="View file"
                  >
                    <Eye className="w-5 h-5" />
                  </a>
                )}
                {!isOwner ? (
                  <button
                    onClick={async () => {
                      try {
                        await supabase
                          .from('pending_evidence')
                          .update({ status: 'withdrawn' })
                          .eq('id', evidence.id)
                          .eq('status', 'pending')
                        queryClient.invalidateQueries({ queryKey: ['pending-evidence'] })
                      } catch {}
                    }}
                    className="text-red-600 hover:text-red-700"
                    title="Withdraw request"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleReject(evidence)}
                    disabled={rejectMutation.isPending}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                    title="Reject"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Description now included in the single-row grid above */}

            {/* Removed duplicate view link (now in grid row 2 col 4) */}

            <div className="flex space-x-3">
              {isOwner ? (
                <>
                  <button
                    onClick={() => handleApprove(evidence)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                    style={{ 
                      backgroundColor: 'rgba(30, 58, 138, 0.3)',
                      border: '2px solid #10b981',
                      color: '#10b981'
                    }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                </>
              ) : null}
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
                className="px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ 
                  backgroundColor: 'rgba(30, 58, 138, 0.3)',
                  border: '2px solid #10b981',
                  color: '#10b981'
                }}
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
