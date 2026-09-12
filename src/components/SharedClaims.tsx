import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useNavigation } from '@/contexts/NavigationContext'
import CollaborationHub from './CollaborationHub'
import EvidenceManager from './EvidenceManager'
import { Users, Edit, Trash2, UserPlus, CheckSquare, CalendarClock, Lock } from 'lucide-react'
import { AlertsSummaryCard } from './AlertsSummaryCard'
import { useAlertsSummary } from '@/hooks/useAlertsSummary'

interface SharedClaimsProps {
  selectedClaim: string | null
  claimColor?: string
  currentUserId?: string
  isGuest?: boolean
  prioritizeGuestClaims?: boolean
}

const SharedClaims = ({
  selectedClaim,
  claimColor = '#3B82F6',
  currentUserId,
  isGuest = false,
  prioritizeGuestClaims = false
}: SharedClaimsProps) => {
  const { navigateBack, navigateTo } = useNavigation()
  const [showCollaboration, setShowCollaboration] = useState(false)
  const [claimView, setClaimView] = useState<'active' | 'closed'>('active')
  const [claimPendingDeletion, setClaimPendingDeletion] = useState<any | null>(null)
  const queryClient = useQueryClient()

  // Shared-scope alerts give us per-claim counters for tasks and calendar reminders
  const { data: sharedAlerts } = useAlertsSummary('shared')

  React.useEffect(() => {
    const onToggle = () => setShowCollaboration((v) => !v)
    window.addEventListener('toggleCollaboration', onToggle as EventListener)
    return () => window.removeEventListener('toggleCollaboration', onToggle as EventListener)
  }, [])

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('collaborationState', {
      detail: { open: showCollaboration && !!selectedClaim },
    }))
  }, [showCollaboration, selectedClaim])

  const { data: sharedClaimsResult, isLoading } = useQuery({
    queryKey: ['shared-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      
      
      // Get both claims owned by user and claims shared with user
      const [ownedShares, sharedWithMe] = await Promise.all([
        // Claims owned by user that are shared with others
        supabase
          .from('claim_shares')
          .select(`
            *,
            claims:claim_id (
              claim_id,
              case_number,
              title,
              court,
              color,
              status,
              defendant_name,
              plaintiff_name,
              created_at,
              user_id
            )
          `)
          .eq('owner_id', user.id),
        
        // Claims shared with user by others
        supabase
          .from('claim_shares')
          .select(`
            *,
            claims:claim_id (
              claim_id,
              case_number,
              title,
              court,
              color,
              status,
              defendant_name,
              plaintiff_name,
              created_at,
              user_id
            )
          `)
          .eq('shared_with_id', user.id)
      ])
      
      // Be resilient to RLS errors: use what we can
      const ownedData = ownedShares.error ? [] : (ownedShares.data || [])
      const sharedData = sharedWithMe.error ? [] : (sharedWithMe.data || [])
      
      // Combine both results, prioritizing guest claims if requested
      const allShares = [...ownedData, ...sharedData]

      let sharesOrdered = prioritizeGuestClaims
        ? [...sharedData, ...ownedData]
        : allShares

      // If join to claims was blocked, fetch claim details separately
      const missingClaimDetails = sharesOrdered.filter((s: any) => !s.claims || !s.claims.case_number)
      if (missingClaimDetails.length) {
        const claimIds = Array.from(new Set(missingClaimDetails.map((s: any) => s.claim_id).filter(Boolean)))
        if (claimIds.length) {
          const { data: claimsInfo } = await supabase
            .from('claims')
            .select('claim_id, case_number, title, court, color, status, defendant_name, plaintiff_name, created_at, user_id')
            .in('claim_id', claimIds as any)
          const byId: Record<string, any> = {}
          for (const c of claimsInfo || []) byId[c.claim_id] = c
          for (const s of sharesOrdered) {
            if (!s.claims && s.claim_id && byId[s.claim_id]) {
              s.claims = byId[s.claim_id]
            }
          }
        }
      }

      // Keep closed shared claims available for the Shared Closed Cases view.
      // Shares with missing claim data cannot be rendered safely.
      sharesOrdered = sharesOrdered.filter((s: any) => {
        const status = s.claims?.status
        return Boolean(status && s.claims)
      })

      // Fetch display profiles (nickname/email) for owners and guests
      const userIds = Array.from(new Set(
        sharesOrdered.flatMap((s: any) => [s.owner_id, s.shared_with_id]).filter(Boolean)
      ))
      let profilesById: Record<string, { id: string; email?: string | null; full_name?: string | null; nickname?: string | null }> = {}
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, nickname')
          .in('id', userIds as any)
        if (!profilesError) {
          for (const p of profiles || []) {
            profilesById[p.id] = p
          }
        }
      }

      return { shares: sharesOrdered, profilesById }
    }
  })

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading shared claims...</div>
  }

  const shares = ((sharedClaimsResult as any)?.shares || []) as any[]
  const visibleShares = shares.filter((share) => {
    const isClosed = share.claims?.status?.toString().toLowerCase() === 'closed'
    return claimView === 'closed' ? isClosed : !isClosed
  })

  const exportBeforeDeleting = () => {
    if (!claimPendingDeletion?.claims?.case_number) return
    window.dispatchEvent(new CustomEvent('claimSelected', {
      detail: {
        claimId: claimPendingDeletion.claims.case_number,
        claimColor: claimPendingDeletion.claims.color || '#3B82F6',
      },
    }))
    setClaimPendingDeletion(null)
    navigateTo('export')
  }

  return (
    <div>
      {claimPendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card-enhanced w-full max-w-md p-6" role="dialog" aria-modal="true" aria-labelledby="delete-shared-claim-title">
            <h2 id="delete-shared-claim-title" className="text-xl font-semibold text-gold">
              Delete claim?
            </h2>
            <p className="mt-3 text-sm text-gray-300">
              You are about to permanently delete “{claimPendingDeletion.claims?.title || claimPendingDeletion.claims?.case_number}”.
              Would you like to export its data first?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setClaimPendingDeletion(null)}
                className="rounded-lg border border-gray-400 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={exportBeforeDeleting}
                className="rounded-lg border border-blue-400 px-4 py-2 text-sm text-blue-300 hover:bg-blue-400/10"
              >
                Export data first
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!claimPendingDeletion.claim_id) return
                  const { error } = await supabase
                    .from('claims')
                    .delete()
                    .eq('claim_id', claimPendingDeletion.claim_id)
                  if (error) {
                    console.error('Failed to delete shared claim:', error)
                    window.alert('Unable to delete this claim.')
                    return
                  }
                  setClaimPendingDeletion(null)
                  await queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
                  await queryClient.invalidateQueries({ queryKey: ['claims'] })
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
      <AlertsSummaryCard scope="shared" />
      {claimView === 'closed' && (
        <button
          type="button"
          onClick={() => setClaimView('active')}
          className="mb-4 bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg"
        >
          Back to Shared Claims
        </button>
      )}
      {/* Collaboration Section */}
      {showCollaboration && selectedClaim && (
        <div className="card-enhanced rounded-lg shadow border-l-4 relative z-30 w-full" style={{ borderLeftColor: claimColor }}>
          <div className="p-0 h-[calc(100vh-2rem)]">
            <div className="h-full overflow-hidden">
              <CollaborationHub 
                selectedClaim={selectedClaim} 
                claimColor={claimColor}
                currentUserId={currentUserId}
                isGuest={isGuest}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Claims List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleShares.length > 0 ? (
          visibleShares.map((share: any) => (
            <div 
              key={share.id} 
              className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow max-w-2xl"
              onClick={async () => {
                console.log('Selected shared claim:', share)
                console.log('Claims data:', share.claims)
                console.log('Case number:', share.claims?.case_number)
                
                try {
                  let caseNumber = share.claims?.case_number as string | undefined
                  let color = share.claims?.color || '#3B82F6'

                  // If case_number not present from join, fetch via claim_id
                  if (!caseNumber && share.claim_id) {
                    const { data, error } = await supabase
                      .from('claims')
                      .select('case_number, color')
                      .eq('claim_id', share.claim_id)
                      .maybeSingle()
                    if (!error && data) {
                      caseNumber = data.case_number
                      color = data.color || color
                    }
                  }

                  if (caseNumber) {
                    try {
                      // Stash UUID for guest evidence resolution
                      sessionStorage.setItem('selected_claim_uuid', share.claim_id || '')
                    } catch {}
                    console.log('Dispatching claimSelected event with:', caseNumber)
                    const event = new CustomEvent('claimSelected', {
                      detail: { claimId: caseNumber, claimColor: color }
                    })
                    window.dispatchEvent(event)

                    // Navigate to shared evidence view
                    try { sessionStorage.setItem('welcome_seen_session', '1') } catch {}
                    const tabEvent = new CustomEvent('tabChange', { detail: 'shared' })
                    window.dispatchEvent(tabEvent)

                    // Also use navigation context for redundancy
                    navigateTo('shared')
                  } else {
                    console.warn('Unable to resolve case_number for claim', share.claim_id)
                  }
                } catch (e) {
                  console.warn('Error handling shared claim selection:', e)
                }
              }}
              >
                {/* Header row: title + owner/shared icons + per-claim counters */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: share.claims?.color || '#3B82F6' }}
                      />
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {share.claims?.title || `Claim ${share.claim_id}`}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {(() => {
                      const caseNumber = share.claims?.case_number as string | undefined
                      const perClaim = sharedAlerts?.perClaimAlerts || {}
                      const claimAlerts = caseNumber ? perClaim[caseNumber] : undefined
                      if (!claimAlerts || claimAlerts.total <= 0) {
                        return null
                      }
                      return (
                        <div
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-semibold"
                          title={`${claimAlerts.total} outstanding alert(s) for this shared claim`}
                        >
                          {claimAlerts.total}
                        </div>
                      )
                    })()}
                    {share.owner_id !== currentUserId && (
                      <Users className="w-4 h-4 text-green-500" aria-label="Shared with you" />
                    )}
                    {/* Owner actions: Edit and Delete */}
                    {share.owner_id === currentUserId && (
                      <>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              // Ensure case number is available
                              let caseNumber = share.claims?.case_number as string | undefined
                              if (!caseNumber && share.claim_id) {
                                const { data } = await supabase
                                  .from('claims')
                                  .select('case_number')
                                  .eq('claim_id', share.claim_id)
                                  .maybeSingle()
                                caseNumber = data?.case_number
                              }
                              if (caseNumber) {
                                window.dispatchEvent(new CustomEvent('claimSelected', { detail: { claimId: caseNumber, claimColor: share.claims?.color || '#3B82F6' } }))
                                navigateTo('claims')
                              }
                            } catch {}
                          }}
                          className="p-1 rounded hover:bg-yellow-100 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-yellow-500" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!share.claim_id) return
                            setClaimPendingDeletion(share)
                          }}
                          className="p-1 rounded hover:bg-red-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </>
                    )}
                    {currentUserId && share.owner_id !== currentUserId && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!share.claim_id) return
                          const ok = window.confirm(
                            'Remove this shared claim? This will revoke all host and guest access to the claim.'
                          )
                          if (!ok) return

                          const { error } = await supabase.rpc(
                            'remove_shared_claim_for_guest' as any,
                            { p_claim_id: share.claim_id }
                          )
                          if (error) {
                            console.error('Failed to remove shared claim:', error)
                            window.alert('Unable to remove this shared claim.')
                            return
                          }

                          await queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
                          await queryClient.invalidateQueries({ queryKey: ['alerts-summary', 'shared'] })
                        }}
                        className="p-1 rounded hover:bg-red-100 transition-colors"
                        title="Remove shared claim and revoke all access"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>

              {/* Row 2: Court (left) + Defendant (right, aligned with card edge) */}
              <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                <p className="text-xs text-gray-600 truncate">
                  {share.claims?.court || 'Unknown Court'}
                </p>
                {share.claims?.defendant_name && (
                  <p className="text-xs text-gray-600 text-right truncate">
                    Defendant: {share.claims.defendant_name}
                  </p>
                )}
              </div>
              {/* Row 3: Case Number (left) + Plaintiff (right, aligned with Defendant/date) */}
              <div className="flex items-baseline justify-between gap-2 mt-1 whitespace-nowrap">
                <p className="text-xs text-gray-600 truncate">
                  Case: {share.claims?.case_number || share.claim_id}
                </p>
                {share.claims?.plaintiff_name && (
                  <p className="text-xs text-gray-600 text-right truncate">
                    Plaintiff: {share.claims.plaintiff_name}
                  </p>
                )}
              </div>

              {/* Row 4: Status pill (left) + created date (right), mirroring private claims cards */}
              <div className="flex justify-between items-center mt-2">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    share.claims?.status === 'Active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {share.claims?.status || 'Unknown'}
                </span>
                {share.claims?.created_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(share.claims.created_at as string).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Row 5: Sharing info, aligned with private cards' metadata line */}
              <p className="text-xs text-gray-500 mt-1 truncate">
                {(() => {
                  const profilesById = (sharedClaimsResult as any)?.profilesById || {}
                  const otherUserId = share.owner_id === currentUserId ? share.shared_with_id : share.owner_id
                  const other = otherUserId ? profilesById[otherUserId] : null
                  const name = other?.nickname || other?.full_name || other?.email || 'Unknown user'
                  return share.owner_id === currentUserId 
                    ? `Shared with: ${name}`
                    : `Owner: ${name}`
                })()}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>{claimView === 'closed' ? 'No shared closed cases found' : 'No shared claims found'}</p>
            <p className="text-sm mt-2">
              {claimView === 'closed'
                ? 'Closed claims shared with you will appear here'
                : 'Claims you share or that are shared with you will appear here'}
            </p>
          </div>
        )}

        {claimView === 'active' && (
          <div
            key="shared-closed-cases-card"
            className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow max-w-2xl flex flex-col items-center justify-center text-center"
            style={{ minWidth: '200px', width: '100%', display: 'block' }}
            onClick={() => setClaimView('closed')}
          >
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Closed Cases</h3>
            </div>
            <div className="flex justify-center mb-2">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              View Closed Shared Claims.
            </div>
          </div>
        )}

        {/* "Share a Claim" card on shared page – navigates to private claims to create/share */}
        {claimView === 'active' && (
          <div
            className="card-enhanced p-4 cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center text-center"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('claimSelected', { detail: { claimId: null } }))
                sessionStorage.setItem('welcome_seen_session', '1')
              } catch {}
              navigateTo('claims')
            }}
          >
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-gray-300" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Share a Claim</h3>
            </div>
            <div className="flex justify-center mb-2">
              <UserPlus className="w-12 h-12 text-green-500" />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Click to share a private claim
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SharedClaims
