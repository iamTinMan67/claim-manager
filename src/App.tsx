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
  const [activeTab, setActiveTab] = useState('dashboard')

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthComponent onAuthChange={setUser} />
      </QueryClientProvider>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <ClaimsTable />
            <EvidenceManager />
          </div>
        )
      case 'claims':
        return <ClaimsTable />
      case 'evidence':
        return <EvidenceManager />
      case 'todos':
        return <TodoList />
      case 'calendar':
        return <Calendar />
      case 'collaboration':
        return <SharedClaims />
      case 'export':
        return <ExportFeatures />
      default:
        return <ClaimsTable />
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