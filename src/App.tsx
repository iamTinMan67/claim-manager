import React from 'react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { AuthProvider } from '@/contexts/AuthContext'
import { NavigationProvider, useNavigation } from '@/contexts/NavigationContext'
import AuthComponent from './components/AuthComponent'
import ClaimsTable from './components/ClaimsTable'
import EvidenceManager from './components/EvidenceManager'
import TodoList from './components/TodoList'
import Calendar from './components/Calendar'
import SharedClaims from './components/SharedClaims'
import CollaborationHub from './components/CollaborationHub'
import ExportFeatures from './components/ExportFeatures'
import SubscriptionManager from './components/SubscriptionManager'
import PrivilegesStatus from './components/PrivilegesStatus'
import { Crown } from 'lucide-react'
import AccessControl from './components/AccessControl'

const queryClient = new QueryClient()

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationProvider>
            <AppContent />
          </NavigationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null)
  const { currentPage, navigateTo } = useNavigation()
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null)
  const [selectedClaimColor, setSelectedClaimColor] = useState<string>('#3B82F6')
  const [isGuest, setIsGuest] = useState(false) // TODO: Implement guest detection logic
  const [showGuestContent, setShowGuestContent] = useState(false)
  const [isInSharedContext, setIsInSharedContext] = useState(false) // Track if we're in shared claims context

  // Scroll to top when claims tab is active and no claim is selected
  React.useEffect(() => {
    if (currentPage === 'claims' && !selectedClaim) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentPage, selectedClaim])

  // Scroll to top when component mounts to ensure navbar is visible
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (!user) {
    return <AuthComponent onAuthChange={setUser} />
  }

  return (
    <AuthComponent 
      onAuthChange={setUser}
      activeTab={currentPage}
      onTabChange={navigateTo}
      selectedClaim={selectedClaim}
      isGuest={isGuest}
      showGuestContent={showGuestContent}
      onToggleGuestContent={setShowGuestContent}
    >
      <LoggedInContent 
        activeTab={currentPage}
        setActiveTab={navigateTo}
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
  const { navigateBack, canGoBack } = useNavigation()
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

  // Reset shared context when explicitly navigating to claims tab
  React.useEffect(() => {
    if (activeTab === 'claims' && !selectedClaim) {
      setIsInSharedContext(false)
    }
  }, [activeTab, selectedClaim])
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
    
    console.log('App renderContent:', {
      activeTab,
      isInSharedContext,
      isViewingSharedClaims,
      selectedClaim
    })
    
    switch (activeTab) {
      case 'claims':
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={currentlyGuest} />
      case 'subscription':
        return <SubscriptionManager />
      case 'privileges':
        return <PrivilegesStatus />
      case 'todos-private':
        // If viewing shared claims, show shared version of todos
        return <TodoList selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={false} showGuestContent={false} isGuestFrozen={false} />
      case 'todos-shared':
        return <TodoList selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={true} showGuestContent={true} isGuestFrozen={false} />
      case 'calendar-private':
        // Private calendar at top-level: not tied to a specific claim. Entries must be assigned explicitly.
        return <Calendar selectedClaim={null} claimColor={selectedClaimColor} isGuest={false} showGuestContent={false} isGuestFrozen={false} />
      case 'calendar-shared':
        // Only show shared calendar when explicitly in shared context
        return <Calendar selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={true} showGuestContent={true} isGuestFrozen={false} />
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
    <div className="min-h-screen">
        <main className="container mx-auto px-4 py-2">
          {renderContent()}
        </main>
    </div>
  )
}

export default App