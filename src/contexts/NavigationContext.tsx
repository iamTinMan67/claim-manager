import React, { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface NavigationContextType {
  currentPage: string
  previousPage: string | null
  navigateTo: (page: string) => void
  navigateBack: () => void
  canGoBack: boolean
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}

interface NavigationProviderProps {
  children: React.ReactNode
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState('subscription')
  const [previousPage, setPreviousPage] = useState<string | null>(null)
  const [pageHistory, setPageHistory] = useState<string[]>(['subscription'])

  const navigateTo = useCallback((page: string) => {
    // Always allow navigating to subscription
    if (page === 'subscription') {
      setPreviousPage(currentPage)
      setCurrentPage('subscription')
      setPageHistory(prev => [...prev, 'subscription'])
      return
    }

    // Backend-enforced gate: require a selection/subscriber record
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setPreviousPage(currentPage)
          setCurrentPage('subscription')
          setPageHistory(prev => [...prev, 'subscription'])
          return
        }
        const { data } = await supabase
          .from('subscribers')
          .select('subscribed')
          .eq('user_id', user.id)
          .maybeSingle()
        const allowed = !!data?.subscribed
        if (!allowed) {
          setPreviousPage(currentPage)
          setCurrentPage('subscription')
          setPageHistory(prev => [...prev, 'subscription'])
          return
        }

        setPreviousPage(currentPage)
        setCurrentPage(page)
        setPageHistory(prev => [...prev, page])
      } catch {
        setPreviousPage(currentPage)
        setCurrentPage('subscription')
        setPageHistory(prev => [...prev, 'subscription'])
      }
    })()
  }, [currentPage])

  const navigateBack = useCallback(() => {
    if (pageHistory.length > 1) {
      const newHistory = [...pageHistory]
      newHistory.pop() // Remove current page
      const previous = newHistory[newHistory.length - 1]
      
      setPageHistory(newHistory)
      setCurrentPage(previous)
      setPreviousPage(newHistory.length > 1 ? newHistory[newHistory.length - 2] : null)
    }
  }, [pageHistory])

  const canGoBack = pageHistory.length > 1

  return (
    <NavigationContext.Provider value={{
      currentPage,
      previousPage,
      navigateTo,
      navigateBack,
      canGoBack
    }}>
      {children}
    </NavigationContext.Provider>
  )
}
