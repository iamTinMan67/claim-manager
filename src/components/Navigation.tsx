import React, { useEffect, useState } from 'react'
import { Calendar, FileText, Users, CheckSquare, Download, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { supabase } from '@/integrations/supabase/client'

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
  selectedClaim?: string | null
  isGuest?: boolean
  showGuestContent?: boolean
  onToggleGuestContent?: (show: boolean) => void
}

const Navigation = ({ activeTab, onTabChange, selectedClaim, isGuest = false, showGuestContent = false, onToggleGuestContent }: NavigationProps) => {
  const { theme, setTheme } = useTheme()
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [subReady, setSubReady] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return
      if (!user) { setIsSubscribed(false); setSubReady(true); return }
      const { data } = await supabase
        .from('subscribers')
        .select('subscribed')
        .eq('user_id', user.id)
        .maybeSingle()
      setIsSubscribed(!!data?.subscribed)
      setSubReady(true)
    })
    return () => { mounted = false }
  }, [])

  // Hide entire navbar until subscribed
  if (!subReady || !isSubscribed) {
    return null
  }

  const navItems = [
    { id: 'claims', label: 'Claims', icon: FileText },
    { id: 'todos-private', label: 'To-Do Lists', icon: CheckSquare },
    { id: 'calendar-private', label: 'Calendar', icon: Calendar },
    { id: 'shared', label: 'Shared Claims', icon: Users },
    // Shared-specific entries appear only when activeTab === 'shared'
    ...(activeTab === 'shared' ? [
      { id: 'todos-shared', label: 'Shared To-Do Lists', icon: CheckSquare, requiresClaim: true },
      { id: 'calendar-shared', label: 'Shared Calendar', icon: Calendar, requiresClaim: true },
      { id: 'export', label: 'Export', icon: Download, requiresClaim: true },
    ] : [{ id: 'export', label: 'Export', icon: Download, requiresClaim: true }])
  ]

  return (
    <nav className="card-smudge shadow-lg border-b border-yellow-400/20">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-8">
          {/* Hide all navigation when on welcome screen and not subscribed */}
          {!(activeTab === 'subscription' && !isSubscribed) && navItems.map((item) => {

            // Hide only the current private tab link to reduce clutter
            if (activeTab === 'calendar-private' && item.id === 'calendar-private') {
              return null
            }
            if (activeTab === 'todos-private' && item.id === 'todos-private') {
              return null
            }
            
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === item.id
                      ? 'border-yellow-400 text-gold'
                      : 'border-transparent text-gold-light hover:text-gold hover:border-yellow-400/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
          </div>
          <div className="flex items-center space-x-3">
            {/* Guest Content Toggle - only show for claim owners when viewing todos/calendar */}
            {!isGuest && (activeTab === 'todos' || activeTab === 'calendar') && onToggleGuestContent && (
              <button
                onClick={() => onToggleGuestContent(!showGuestContent)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  showGuestContent
                    ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
                title={showGuestContent ? 'Switch to your private view' : 'View guest contributions'}
              >
                <Users className="w-4 h-4 inline mr-1" />
                {showGuestContent ? 'Guest View' : 'My View'}
              </button>
            )}
            
            {/* Guest Indicator */}
            {isGuest && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium">
                <Users className="w-4 h-4 inline mr-1" />
                Guest Access
              </div>
            )}
            
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-yellow-400/20 transition-colors text-gold"
              title="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation