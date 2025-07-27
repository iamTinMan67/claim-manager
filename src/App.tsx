import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ClaimsTable from './components/ClaimsTable'
import EvidenceTable from './components/EvidenceTable'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Legal Evidence Management
            </h1>
            <p className="text-gray-600">
              Manage your legal claims and evidence
            </p>
          </div>
          
          <div className="space-y-8">
            <ClaimsTable />
            <EvidenceTable />
          </div>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App