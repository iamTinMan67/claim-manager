import React from 'react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthComponent onAuthChange={setUser} />
      </QueryClientProvider>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'claims':
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} />
      case 'todos':
        return <TodoList selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      case 'calendar':
        return <Calendar selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      case 'collaboration':
        return <SharedClaims selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      case 'export':
        return <ExportFeatures selectedClaim={selectedClaim} claimColor={selectedClaimColor} />
      default:
        return <ClaimsTable onClaimSelect={setSelectedClaim} selectedClaim={selectedClaim} onClaimColorChange={setSelectedClaimColor} />
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthComponent onAuthChange={setUser}>
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        {renderContent()}
      </AuthComponent>
    </QueryClientProvider>
  )
}

export default App