import React from 'react'
import { Calendar, FileText, Users, CheckSquare, Home, Upload, Download, Moon, Sun, MessageCircle, Crown } from 'lucide-react'
import { useTheme } from 'next-themes'

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isGuest?: boolean
  showGuestContent?: boolean
  onToggleGuestContent?: (show: boolean) => void
}

const Navigation = ({ activeTab, onTabChange, isGuest = false, showGuestContent = false, onToggleGuestContent }: NavigationProps) => {
  const { theme, setTheme } = useTheme()

  const navItems = [
    { id: 'claims', label: 'Claims', icon: FileText },
    { id: 'todos', label: 'To-Do Lists', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'collaboration', label: 'Collaboration', icon: MessageCircle },
    { id: 'shared', label: 'Shared Claims', icon: Users },
    { id: 'export', label: 'Export', icon: Download },
  ]

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-8">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === item.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
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
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation