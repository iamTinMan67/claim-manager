import React from 'react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import AuthComponent from './components/AuthComponent'
import Navigation from './components/Navigation'
import ClaimsTable from './components/ClaimsTable'
import EvidenceManager from './components/EvidenceManager'
import TodoList from './components/TodoList'
import Calendar from './components/Calendar'
import SharedClaims from './components/SharedClaims'
import CollaborationHub from './components/CollaborationHub'
import ExportFeatures from './components/ExportFeatures'
import SubscriptionManager from './components/SubscriptionManager'
import { Crown } from 'lucide-react'
import AccessControl from './components/AccessControl'

const queryClient = new QueryClient()

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('claims')
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null)
  const [selectedClaimColor, setSelectedClaimColor] = useState<string>('#3B82F6')
  const [isGuest, setIsGuest] = useState(false) // TODO: Implement guest detection logic
  const [showGuestContent, setShowGuestContent] = useState(false)
  const [isInSharedContext, setIsInSharedContext] = useState(false) // Track if we're in shared claims context

  if (!user) {
    return <AuthComponent onAuthChange={setUser} />
  }

  return (
    <AuthComponent onAuthChange={setUser}>
      <LoggedInContent 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedClaim={selectedClaim}
        setSelectedClaim={setSelectedClaim}
        selectedClaimColor={selectedClaimColor}
        setSelectedClaimColor={setSelectedClaimColor}
        isGuest={isGuest}
        showGuestContent={showGuestContent}
        setShowGuestContent={setShowGuestContent}
        user={user}
        isInSharedContext={isInSharedContext}
        setIsInSharedContext={setIsInSharedContext}
      />
    </AuthComponent>
  )
}

function LoggedInContent({ 
  activeTab, 
  setActiveTab, 
  selectedClaim, 
  setSelectedClaim, 
  selectedClaimColor, 
  setSelectedClaimColor, 
  isGuest, 
  showGuestContent, 
  setShowGuestContent,
  user,
  isInSharedContext,
  setIsInSharedContext
}: {
  activeTab: string
  setActiveTab: (tab: string) => void
  selectedClaim: string | null
  setSelectedClaim: (claim: string | null) => void
  selectedClaimColor: string
  setSelectedClaimColor: (color: string) => void
  isGuest: boolean
  showGuestContent: boolean
  setShowGuestContent: (show: boolean) => void
  user: any
  isInSharedContext: boolean
  setIsInSharedContext: (value: boolean) => void
}) {
  // Listen for claim selection events from SharedClaims component
  React.useEffect(() => {
    const handleClaimSelected = (event: CustomEvent) => {
      const { claimId, claimColor } = event.detail
      setSelectedClaim(claimId)
      if (claimColor) {
        setSelectedClaimColor(claimColor)
      }
    }

    const handleTabChange = (event: CustomEvent) => {
      const tab = event.detail
      setActiveTab(tab)
    }

    window.addEventListener('claimSelected', handleClaimSelected as EventListener)
    window.addEventListener('tabChange', handleTabChange as EventListener)
    return () => {
      window.removeEventListener('claimSelected', handleClaimSelected as EventListener)
      window.removeEventListener('tabChange', handleTabChange as EventListener)
    }
  }, [setSelectedClaim, setSelectedClaimColor, setActiveTab])

  // Handle shared context when navigating from shared claims
  React.useEffect(() => {
    if (activeTab === 'shared') {
      setIsInSharedContext(true)
    } else if (activeTab === 'claims') {
      setIsInSharedContext(false)
    }
  }, [activeTab])
  // Check if current user is viewing a shared claim (guest mode)
  const { data: isGuestForClaim } = useQuery({
    queryKey: ['is-guest-for-claim', selectedClaim, user?.id],
    queryFn: async () => {
      if (!selectedClaim || !user?.id) return false
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select('id')
        .eq('claim_id', selectedClaim)
        .eq('shared_with_id', user.id)
        .maybeSingle()
      
      if (error) return false
      return !!data
    },
    enabled: !!selectedClaim && !!user?.id
  })

  // Get guest status for current user
  const { data: guestStatus } = useQuery({
    queryKey: ['guest-status-app', selectedClaim, user?.id],
    queryFn: async () => {
      if (!selectedClaim || !user?.id) return null
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select('is_frozen, is_muted')
        .eq('claim_id', selectedClaim)
        .eq('shared_with_id', user.id)
        .maybeSingle()
      
      if (error) return null
      return data
    },
    enabled: !!selectedClaim && !!user?.id && isGuestForClaim
  })

  // Determine if user is currently in guest mode for the selected claim
  const currentlyGuest = isGuestForClaim || false

  const renderContent = () => {
    // Check if we're currently viewing shared claims or in shared context
    const isViewingSharedClaims = activeTab === 'shared' || isInSharedContext
    
    switch (activeTab) {
      case 'claims':
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={currentlyGuest} />
      case 'subscription':
        return <SubscriptionManager />
      case 'todos':
        // If viewing shared claims, show shared version of todos
        if (isViewingSharedClaims) {
          return <TodoList selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={true} showGuestContent={true} isGuestFrozen={false} />
        }
        return <TodoList selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={currentlyGuest} showGuestContent={showGuestContent} isGuestFrozen={guestStatus?.is_frozen || false} />
      case 'calendar':
        // If viewing shared claims, show shared version of calendar
        if (isViewingSharedClaims) {
          return <Calendar selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={true} showGuestContent={true} isGuestFrozen={false} />
        }
        return <Calendar selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={currentlyGuest} showGuestContent={showGuestContent} isGuestFrozen={guestStatus?.is_frozen || false} />
      case 'shared':
        return <SharedClaims selectedClaim={selectedClaim} claimColor={selectedClaimColor} currentUserId={user?.id} isGuest={currentlyGuest} />
      case 'export':
        // If viewing shared claims, show shared version of export
        if (isViewingSharedClaims) {
          return <ExportFeatures selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={true} showGuestContent={true} isGuestFrozen={false} />
        }
        return <ExportFeatures selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      default:
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={currentlyGuest} />
    }
  }

  return (
    <>
        <Navigation 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          selectedClaim={selectedClaim}
          isGuest={currentlyGuest}
          showGuestContent={showGuestContent}
          onToggleGuestContent={setShowGuestContent}
        />
        {renderContent()}
    </>
  )
}

export default App