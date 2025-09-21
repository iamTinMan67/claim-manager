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
          <div className="flex space-x-1 bg-white/10 rounded-lg p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'todos' | 'calendar')}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30'
                      : 'text-gold-light hover:text-gold hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="card-enhanced p-6">
          {activeTab === 'todos' && (
            <div>
              <h2 className="text-xl font-semibold text-gold mb-4 flex items-center space-x-2">
                <CheckSquare className="w-6 h-6" />
                <span>To-Do Lists</span>
              </h2>
              <TodoList 
                selectedClaim={selectedClaim}
                isGuest={isGuest}
                isGuestFrozen={isGuestFrozen}
                currentUserId={currentUserId}
              />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div>
              <h2 className="text-xl font-semibold text-gold mb-4 flex items-center space-x-2">
                <Calendar className="w-6 h-6" />
                <span>Calendar Events</span>
              </h2>
              <CalendarComponent 
                selectedClaim={selectedClaim}
                isGuest={isGuest}
                isGuestFrozen={isGuestFrozen}
                currentUserId={currentUserId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Events
