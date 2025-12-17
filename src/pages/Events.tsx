import React, { useState } from 'react'
import { CheckSquare, Calendar } from 'lucide-react'
import TodoList from '@/components/TodoList'
import CalendarComponent from '@/components/Calendar'

interface EventsProps {
  selectedClaim: string | null
  isGuest?: boolean
  isGuestFrozen?: boolean
  currentUserId?: string
}

const Events: React.FC<EventsProps> = ({ 
  selectedClaim, 
  isGuest = false, 
  isGuestFrozen = false, 
  currentUserId 
}) => {
  const [activeTab, setActiveTab] = useState<'todos' | 'calendar'>('todos')

  const tabs = [
    { id: 'todos', label: 'To-Do Lists', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar }
  ]

  return (
    <div className="min-h-screen p-6">
      <div className={activeTab === 'calendar' ? 'w-full' : 'max-w-7xl mx-auto'}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gold mb-2 text-center">Events</h1>
          <p className="text-gold-light">
            Manage your to-do lists and calendar events for {selectedClaim ? `case ${selectedClaim}` : 'your claims'}
          </p>
        </div>

        {/* Tab Content */}
        <div
          className={`card-enhanced p-6 mb-6 ${activeTab === 'calendar' ? 'w-full' : ''}`}
          style={activeTab === 'calendar' ? undefined : { width: '508px' }}
        >
          {/* Title */}
          <div className="flex items-center mb-6">
            <h2 className="text-2xl font-bold">
              {activeTab === 'todos' ? 'To-Do Lists' : 'Calendar Events'}
            </h2>
          </div>
          <div className="min-h-[400px]">
            {activeTab === 'todos' && (
              <div>
                <div className="flex space-x-1 mb-4">
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    // Hide the active tab
                    if (activeTab === tab.id) {
                      return null
                    }
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'todos' | 'calendar')}
                        className="flex items-center justify-start space-x-2 px-4 py-2 rounded-lg transition-colors text-gray-300 hover:bg-white/10 border-2 border-transparent"
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
                <TodoList 
                  selectedClaim={selectedClaim}
                  claimColor="#3B82F6"
                  isGuest={isGuest}
                  showGuestContent={false}
                  isGuestFrozen={isGuestFrozen}
                  showNavigation={false}
                />
              </div>
            )}

            {activeTab === 'calendar' && (
              <div>
                <div className="flex space-x-1 mb-4">
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    // Hide the active tab
                    if (activeTab === tab.id) {
                      return null
                    }
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'todos' | 'calendar')}
                        className="flex items-center justify-start space-x-2 px-4 py-2 rounded-lg transition-colors text-gray-300 hover:bg-white/10 border-2 border-transparent"
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
                <CalendarComponent 
                  selectedClaim={selectedClaim}
                  claimColor="#3B82F6"
                  isGuest={isGuest}
                  showGuestContent={false}
                  isGuestFrozen={isGuestFrozen}
                  showNavigation={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Events
