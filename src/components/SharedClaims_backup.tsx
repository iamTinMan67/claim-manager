import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useNavigation } from '@/contexts/NavigationContext'
import CollaborationHub from './CollaborationHub'
import EvidenceManager from './EvidenceManager'

interface SharedClaimsProps {
  selectedClaim: string | null
  claimColor?: string
  currentUserId?: string
  isGuest?: boolean
  prioritizeGuestClaims?: boolean
}

const SharedClaims = ({ selectedClaim, claimColor = '#3B82F6', currentUserId, isGuest = false, prioritizeGuestClaims = false }: SharedClaimsProps) => {
  const { navigateBack, navigateTo } = useNavigation()
  const [showCollaboration, setShowCollaboration] = useState(false)

  const { data: sharedClaims, isLoading } = useQuery({
    queryKey: ['shared-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select(`
          *,
          claims:claim_id (
            claim_id,
            case_number,
            title,
            color,
            user_id
          )
        `)
        .eq('owner_id', user.id)
        .eq('status', 'accepted')
      
      if (error) throw error
      return data || []
    }
  })

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading shared claims...</div>
  }

  return (
    <div>
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
      <div className="space-y-4">
        {sharedClaims?.map((share) => (
          <div key={share.id} className="card-enhanced p-4">
            <h3 className="text-lg font-semibold">{share.claims?.title}</h3>
            <p className="text-sm text-gray-600">Case: {share.claims?.case_number}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SharedClaims
