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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gold mb-2">Events</h1>
          <p className="text-gold-light">
            Manage your to-do lists and calendar events for {selectedClaim ? `case ${selectedClaim}` : 'your claims'}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="card-enhanced p-6 mb-6">
          <div className="flex space-x-1 mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'todos' | 'calendar')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-yellow-400 text-black'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'todos' && (
              <div>
                <TodoList 
                  selectedClaim={selectedClaim}
                  claimColor="#3B82F6"
                  isGuest={isGuest}
                  showGuestContent={isGuest}
                  isGuestFrozen={isGuestFrozen}
                  showNavigation={false}
                />
              </div>
            )}

            {activeTab === 'calendar' && (
              <div>
                <CalendarComponent 
                  selectedClaim={selectedClaim}
                  claimColor="#3B82F6"
                  isGuest={isGuest}
                  showGuestContent={isGuest}
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
