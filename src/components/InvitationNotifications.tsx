import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { CheckCircle, XCircle, Clock, AlertCircle, Send, Bell, FileText } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useNavigation } from '@/contexts/NavigationContext'

interface PendingInvitation {
  id: string
  claim_id: string
  owner_id: string
  invited_user_id: string
  invited_email: string
  permission: string
  can_view_evidence: boolean
  is_frozen: boolean
  is_muted: boolean
  donation_amount: number
  donation_required: boolean
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at: string
  created_at: string
  claims?: {
    title: string
    case_number: string
    color: string
  }
  owner?: {
    email: string
    nickname: string
  }
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: any
  read_at: string | null
  created_at: string
}

interface PendingEvidenceForHost {
  id: string
  claim_id: string
  file_name: string | null
  description: string
  submitted_at: string
  claims: { case_number: string; title: string; color: string } | null
}

const InvitationNotifications = () => {
  const [showNotifications, setShowNotifications] = useState(false)
  const queryClient = useQueryClient()
  const { navigateTo } = useNavigation()

  // Fetch pending invitations RECEIVED (I'm the invited user)
  const { data: pendingInvitationsReceived } = useQuery({
    queryKey: ['pending-invitations-received'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      try {
        // First, try to fetch invitations with joins
        const { data, error } = await supabase
          .from('pending_invitations')
          .select(`
            *,
            claims!claim_id (
              title,
              case_number,
              color
            )
          `)
          .eq('invited_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (error) {
          // If it's a 400 error, the table likely doesn't exist or has wrong structure
          if (error.code === 'PGRST116' || error.message?.includes('400')) {
            console.warn('pending_invitations table not accessible, skipping invitations')
            return []
          }
          console.warn('Error fetching pending invitations received:', error)
          return []
        }

        // Fetch owner profiles separately if we have invitations
        if (data && data.length > 0) {
          const ownerIds = Array.from(new Set(data.map((inv: any) => inv.owner_id).filter(Boolean)))
          if (ownerIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, email, nickname')
              .in('id', ownerIds)
            
            const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]))
            
            // Attach owner data to each invitation
            return data.map((inv: any) => ({
              ...inv,
              owner: profilesMap.get(inv.owner_id) || null
            })) as PendingInvitation[]
          }
        }

        return (data || []) as PendingInvitation[]
      } catch (err) {
        console.warn('Exception fetching pending invitations received:', err)
        return []
      }
    },
    retry: false, // Don't retry on error
    refetchOnWindowFocus: false // Don't refetch on window focus
  })

  // Fetch pending invitations SENT (I'm the owner)
  const { data: pendingInvitationsSent } = useQuery({
    queryKey: ['pending-invitations-sent'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      try {
        const { data, error } = await supabase
          .from('pending_invitations')
          .select(`
            *,
            claims!claim_id (
              title,
              case_number,
              color
            )
          `)
          .eq('owner_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (error) {
          // If it's a 400 error, the table likely doesn't exist or has wrong structure
          if (error.code === 'PGRST116' || error.message?.includes('400')) {
            console.warn('pending_invitations table not accessible, skipping invitations')
            return []
          }
          console.warn('Error fetching pending invitations sent:', error)
          return []
        }
        return (data || []) as PendingInvitation[]
      } catch (err) {
        console.warn('Exception fetching pending invitations sent:', err)
        return []
      }
    },
    retry: false, // Don't retry on error
    refetchOnWindowFocus: false // Don't refetch on window focus
  })

  // Fetch unread notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data as Notification[]
    }
  })

  // Pending evidence for claims I own (host approvals to accept/reject) – list for dropdown and count for badge
  const { data: pendingEvidenceForHost = [] } = useQuery({
    queryKey: ['pending-evidence-count-host'],
    queryFn: async (): Promise<PendingEvidenceForHost[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data: myClaims, error: claimsError } = await supabase
        .from('claims')
        .select('claim_id')
        .eq('user_id', user.id)
      if (claimsError || !myClaims?.length) return []
      const claimIds = myClaims.map((c: { claim_id: string }) => c.claim_id)
      const { data, error } = await supabase
        .from('pending_evidence')
        .select(`
          id,
          claim_id,
          file_name,
          description,
          submitted_at,
          claims!claim_id ( case_number, title, color )
        `)
        .eq('status', 'pending')
        .in('claim_id', claimIds)
        .order('submitted_at', { ascending: false })
      if (error) return []
      return (data || []).map((row: any) => {
        const claim = Array.isArray(row.claims) ? row.claims[0] : row.claims
        return {
          id: row.id,
          claim_id: row.claim_id,
          file_name: row.file_name,
          description: row.description,
          submitted_at: row.submitted_at,
          claims: claim || null
        }
      })
    }
  })

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      console.log('Notifications: Accepting invitation', invitationId)
      const { data, error } = await supabase.rpc('accept_invitation', {
        invitation_id: invitationId
      })
      if (error) {
        console.error('Notifications: accept_invitation error', error)
        throw error
      }
      console.log('Notifications: accept_invitation success', data)
      return data
    },
    onSuccess: async (_data, variables) => {
      toast({ title: 'Invitation accepted', description: 'The claim has been added to Shared.' })
      // Fair usage warning for free-tier users (non-blocking)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: subscriber } = await supabase
            .from('subscribers')
            .select('subscription_tier')
            .eq('user_id', user.id)
            .maybeSingle()
          const tier = (subscriber?.subscription_tier || 'free').toLowerCase()
          if (tier === 'free') {
            toast({
              title: 'Fair usage',
              description: 'Free plan: you can invite 1 guest total across your hosted claims. You can be a guest on unlimited claims.'
            })
          }
        }
      } catch {}
      try {
        // Mark related notification as read so the badge clears immediately
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .filter('data->>invitation_id', 'eq', String(variables))
        }
      } catch (e) {
        console.warn('Notifications: failed to mark invitation notification as read', e)
      }
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-received'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-sent'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
      queryClient.invalidateQueries({ queryKey: ['guest-claims'] })
      // Close dropdown so the accepted item clears immediately
      setShowNotifications(false)
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to accept invitation.'
      toast({ title: 'Accept failed', description: msg })
    }
  })

  // Decline invitation mutation
  const declineInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      console.log('Notifications: Declining invitation', invitationId)
      const { data, error } = await supabase.rpc('decline_invitation', {
        invitation_id: invitationId
      })
      if (error) {
        console.error('Notifications: decline_invitation error', error)
        throw error
      }
      return data
    },
    onSuccess: () => {
      toast({ title: 'Invitation declined' })
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-received'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-sent'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setShowNotifications(false)
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to decline invitation.'
      toast({ title: 'Decline failed', description: msg })
    }
  })

  // Count: pending invitations received + unread notifications + pending evidence for host to approve
  const unreadNotifications = (notifications || []).filter(n => !n.read_at)
  const totalUnread =
    (pendingInvitationsReceived?.length || 0) +
    unreadNotifications.length +
    (pendingEvidenceForHost?.length || 0)

  const goToClaimForEvidenceReview = (caseNumber: string, color: string) => {
    setShowNotifications(false)
    window.dispatchEvent(new CustomEvent('claimSelected', { detail: { claimId: caseNumber, claimColor: color || '#3B82F6' } }))
    window.dispatchEvent(new CustomEvent('tabChange', { detail: 'claims' }))
    navigateTo('claims')
  }

  const Dropdown = (
    <div className="fixed right-4 top-16 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[5000] max-h-96 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Notifications
        </h3>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {/* Pending Invitations (Received) */}
        {pendingInvitationsReceived && pendingInvitationsReceived.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pending Invitations
            </h4>
            {pendingInvitationsReceived.map((invitation) => (
              <div key={invitation.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: invitation.claims?.color || '#3B82F6' }} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {invitation.claims?.title || invitation.claims?.case_number}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Invited by {invitation.owner?.nickname || invitation.owner?.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => acceptInvitationMutation.mutate(invitation.id)}
                      disabled={acceptInvitationMutation.isPending}
                      className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => declineInvitationMutation.mutate(invitation.id)}
                      disabled={declineInvitationMutation.isPending}
                      className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending evidence to review (host) */}
        {pendingEvidenceForHost && pendingEvidenceForHost.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <FileText className="w-4 h-4 mr-2 text-amber-500" /> Evidence to review
            </h4>
            {pendingEvidenceForHost.map((item) => (
              <div key={item.id} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.claims?.color || '#3B82F6' }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.claims?.title || item.claims?.case_number || 'Claim'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {item.file_name || item.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Submitted {new Date(item.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      item.claims &&
                      goToClaimForEvidenceReview(item.claims.case_number, item.claims.color)
                    }
                    className="shrink-0 px-2 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending Invitations (Sent by me) */}
        {pendingInvitationsSent && pendingInvitationsSent.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Send className="w-4 h-4 mr-2 text-gray-500" /> Invitations You Sent
            </h4>
            {pendingInvitationsSent.map((invitation) => (
              <div key={invitation.id} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: invitation.claims?.color || '#3B82F6' }} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {invitation.claims?.title || invitation.claims?.case_number}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Sent to {invitation.invited_email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Other Notifications */}
        {notifications && notifications.length > 0 && (
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Other Notifications
            </h4>
            {notifications.map((notification) => {
              const isInvitation = notification.type === 'invitation' && notification.data?.invitation_id
              return (
                <div key={notification.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2">
                  <div className="flex items-start justify-between space-x-2">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {isInvitation && (
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={() => acceptInvitationMutation.mutate(notification.data.invitation_id)}
                          disabled={acceptInvitationMutation.isPending}
                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                          aria-label="Accept invitation"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => declineInvitationMutation.mutate(notification.data.invitation_id)}
                          disabled={declineInvitationMutation.isPending}
                          className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                          aria-label="Decline invitation"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* No notifications */}
        {(!pendingInvitationsReceived || pendingInvitationsReceived.length === 0) &&
         (!pendingInvitationsSent || pendingInvitationsSent.length === 0) &&
         (!pendingEvidenceForHost || pendingEvidenceForHost.length === 0) &&
         (!notifications || notifications.length === 0) && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No notifications
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="p-2 text-gray-400 hover:text-white relative"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {totalUnread}
          </span>
        )}
      </button>

      {showNotifications && createPortal(Dropdown, document.body)}
    </div>
  )
}

export default InvitationNotifications
