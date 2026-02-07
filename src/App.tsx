import React from 'react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { NavigationProvider, useNavigation } from '@/contexts/NavigationContext'
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils'
import AuthComponent from './components/AuthComponent'
import Auth from './pages/Auth'
import ClaimsTable from './components/ClaimsTable'
import EvidenceManager from './components/EvidenceManager'
import TodoList from './components/TodoList'
import Calendar from './components/Calendar'
import Events from './pages/Events'
import SharedClaims from './components/SharedClaims'
import CollaborationHub from './components/CollaborationHub'
import ExportFeatures from './components/ExportFeatures'
import SubscriptionManager from './components/SubscriptionManager'
import PrivilegesStatus from './components/PrivilegesStatus'
import Admin from './pages/Admin'
import { Crown, ArrowLeft, Home } from 'lucide-react'
import AccessControl from './components/AccessControl'
import { Toaster } from '@/components/ui/toaster'

const queryClient = new QueryClient()

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationProvider>
            <AppContent />
            <Toaster />
          </NavigationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
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

  // Deep link restore: parse URL for shared claim details
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      const claim = params.get('claim') // case_number or claim_id
      const color = params.get('color')
      if (tab === 'shared') {
        navigateTo('shared')
        if (claim) {
          setSelectedClaim(claim)
          if (color) setSelectedClaimColor(color)
          setIsInSharedContext(true)
          sessionStorage.setItem('selected_claim_uuid', claim)
        }
      }
    } catch {}
  }, [])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-gold">Loading...</div>
    </div>
  }

  if (!user) {
    return <Auth />
  }

  return (
    <AuthComponent 
      onAuthChange={() => {}} // No longer needed since we're using AuthContext
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
      
      const claimId = await getClaimIdFromCaseNumber(selectedClaim)
      if (!claimId) return false
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select('id')
        .eq('claim_id', claimId)
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
      
      const claimId = await getClaimIdFromCaseNumber(selectedClaim)
      if (!claimId) return null
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select('is_frozen, is_muted')
        .eq('claim_id', claimId)
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
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={false} />
      case 'closed-claims':
        // Private closed claims view
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={false} statusFilter="Closed" />
      case 'subscription':
        return <SubscriptionManager />
      case 'privileges':
        return <PrivilegesStatus />
      case 'admin':
        return <Admin />
      case 'events-private':
        // Private events (todos and calendar) - not tied to a specific claim
        return <Events selectedClaim={null} isGuest={false} isGuestFrozen={false} currentUserId={user?.id} />
      case 'events-shared':
        // Shared events (todos and calendar) - tied to selected claim
        return <Events selectedClaim={selectedClaim} isGuest={true} isGuestFrozen={false} currentUserId={user?.id} />
      case 'todos-private':
        // Private todos - not tied to a specific claim
        return <Events selectedClaim={null} isGuest={false} isGuestFrozen={false} currentUserId={user?.id} />
      case 'calendar-private':
        // Private calendar - not tied to a specific claim
        return <Events selectedClaim={null} isGuest={false} isGuestFrozen={false} currentUserId={user?.id} />
      case 'shared':
        return selectedClaim
          ? <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={currentlyGuest} />
          : <SharedClaims selectedClaim={selectedClaim} claimColor={selectedClaimColor} currentUserId={user?.id} isGuest={currentlyGuest} prioritizeGuestClaims={!isInSharedContext} />
      case 'todos-shared':
        // Shared todos - tied to selected claim
        return <Events selectedClaim={selectedClaim} isGuest={true} isGuestFrozen={false} currentUserId={user?.id} />
      case 'calendar-shared':
        // Shared calendar - tied to selected claim  
        return <Events selectedClaim={selectedClaim} isGuest={true} isGuestFrozen={false} currentUserId={user?.id} />
      case 'export':
        // If viewing shared claims, show shared version of export
        if (isViewingSharedClaims) {
          return <ExportFeatures selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={true} showGuestContent={true} isGuestFrozen={false} />
        }
        return <ExportFeatures selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      default:
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={false} />
    }
  }

  return (
    <>
      {/* Navigation Buttons for Events pages - Positioned like private claims page */}
        {(activeTab === 'todos-private' || activeTab === 'calendar-private' || activeTab === 'todos-shared' || activeTab === 'calendar-shared' || activeTab === 'events-private' || activeTab === 'events-shared') && (
          <div className="flex justify-between items-center mb-4 px-4 sticky top-0 z-40 backdrop-blur-md py-2 -mx-4 px-4" style={{ backgroundColor: 'transparent' }}>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  sessionStorage.setItem('welcome_seen_session', '1')
                  // Back: if currently on a shared view, go to shared list; otherwise go to private claims
                  if (['events-shared', 'todos-shared', 'calendar-shared', 'shared'].includes(activeTab)) {
                    setActiveTab('shared')
                  } else {
                    setActiveTab('claims')
                  }
                }}
                className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={() => {
                  sessionStorage.setItem('welcome_seen_session', '1')
                  // Navigate to opposite context
                  if (isInSharedContext) {
                    setActiveTab('claims')
                  } else {
                    setActiveTab('shared')
                  }
                }}
                className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>{isInSharedContext ? 'Private Claims' : 'Home'}</span>
              </button>
            </div>
            <div className="flex items-center space-x-2" />
          </div>
        )}
      
      <div>
        <main className="container mx-auto px-4 py-2">
          {renderContent()}
        </main>
      </div>
    </>
  )
}

export default App