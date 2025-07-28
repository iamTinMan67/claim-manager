import React from 'react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { User } from '@supabase/supabase-js'
import AuthComponent from './components/AuthComponent'
import Navigation from './components/Navigation'
import ClaimsTable from './components/ClaimsTable'
import EvidenceManager from './components/EvidenceManager'
import TodoList from './components/TodoList'
import Calendar from './components/Calendar'
import SharedClaims from './components/SharedClaims'
import ExportFeatures from './components/ExportFeatures'

const queryClient = new QueryClient()

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('claims')
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null)
  const [selectedClaimColor, setSelectedClaimColor] = useState<string>('#3B82F6')
  const [isGuest, setIsGuest] = useState(false) // TODO: Implement guest detection logic
  const [showGuestContent, setShowGuestContent] = useState(false)

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
        .single()
      
      if (error) return null
      return data
    },
    enabled: !!selectedClaim && !!user?.id && isGuest
  })

  if (!user) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthComponent onAuthChange={setUser} />
      </QueryClientProvider>
      </ThemeProvider>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'claims':
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={isGuest} />
      case 'todos':
        return <TodoList selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={isGuest} showGuestContent={showGuestContent} isGuestFrozen={guestStatus?.is_frozen || false} />
      case 'calendar':
        return <Calendar selectedClaim={selectedClaim} claimColor={selectedClaimColor} isGuest={isGuest} showGuestContent={showGuestContent} isGuestFrozen={guestStatus?.is_frozen || false} />
      case 'collaboration':
        return <SharedClaims selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      case 'export':
        return <ExportFeatures selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      default:
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} isGuest={isGuest} />
    }
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthComponent onAuthChange={setUser}>
        <Navigation 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          isGuest={isGuest}
          showGuestContent={showGuestContent}
          onToggleGuestContent={setShowGuestContent}
        />
        {renderContent()}
      </AuthComponent>
    </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App