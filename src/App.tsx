import React from 'react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import AuthComponent from './components/AuthComponent'
import ClaimsTable from './components/ClaimsTable'
import EvidenceTable from './components/EvidenceTable'

const queryClient = new QueryClient()

function App() {
  const [user, setUser] = useState<User | null>(null)

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthComponent onAuthChange={setUser} />
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthComponent onAuthChange={setUser}>
        <div className="space-y-8">
          <ClaimsTable />
          <EvidenceTable />
        </div>
      </AuthComponent>
    </QueryClientProvider>
  )
}

export default App