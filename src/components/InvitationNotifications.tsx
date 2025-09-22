import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { CheckCircle, XCircle, Clock, UserPlus, AlertCircle } from 'lucide-react'

interface PendingInvitation {
  id: string
  claim_id: string
  owner_id: string
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
  claims: {
    title: string
    case_number: string
    color: string
  }
  owner: {
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

const InvitationNotifications = () => {
  const [showNotifications, setShowNotifications] = useState(false)
  const queryClient = useQueryClient()

  // Fetch pending invitations
  const { data: pendingInvitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['pending-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_invitations')
        .select(`
          *,
          claims:claim_id (
            title,
            case_number,
            color
          ),
          owner:owner_id (
            email,
            nickname
          )
        `)
        .eq('invited_user_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as PendingInvitation[]
    }
  })

  // Fetch unread notifications
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data as Notification[]
    }
  })

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.rpc('accept_invitation', {
        invitation_id: invitationId
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['shared-claims'] })
    }
  })

  // Decline invitation mutation
  const declineInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.rpc('decline_invitation', {
        invitation_id: invitationId
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const handleAcceptInvitation = (invitationId: string) => {
    acceptInvitationMutation.mutate(invitationId)
  }

  const handleDeclineInvitation = (invitationId: string) => {
    declineInvitationMutation.mutate(invitationId)
  }

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId)
  }

  const totalUnread = (pendingInvitations?.length || 0) + (notifications?.length || 0)

  if (invitationsLoading || notificationsLoading) {
    return (
      <div className="relative">
        <button className="p-2 text-gray-400 hover:text-white">
          <Clock className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="p-2 text-gray-400 hover:text-white relative"
      >
        <UserPlus className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {totalUnread}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 top-12 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Pending Invitations */}
            {pendingInvitations && pendingInvitations.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pending Invitations
                </h4>
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: invitation.claims?.color || '#3B82F6' }}
                          />
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
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          disabled={acceptInvitationMutation.isPending}
                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeclineInvitation(invitation.id)}
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

            {/* Other Notifications */}
            {notifications && notifications.length > 0 && (
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Other Notifications
                </h4>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
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
                  </div>
                ))}
              </div>
            )}

            {/* No notifications */}
            {(!pendingInvitations || pendingInvitations.length === 0) && 
             (!notifications || notifications.length === 0) && (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default InvitationNotifications
