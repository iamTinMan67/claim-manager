import React, { useState } from 'react'
import { CheckSquare, Calendar, Clock } from 'lucide-react'
import TodoList from '@/components/TodoList'
import CalendarComponent from '@/components/Calendar'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { format } from 'date-fns'

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
  const [activeTab, setActiveTab] = useState<'todos' | 'calendar'>('calendar')
  const { events } = useCalendarEvents()

  const tabs = [
    { id: 'todos', label: 'To-Do Lists', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar }
  ]

  const upcomingEvents = events
    .filter((event) => {
      if (event.startTime < new Date()) return false
      return !selectedClaim || event.claimId === selectedClaim
    })
    .slice(0, 8)

  return (
    <div className="min-h-screen p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <p className="text-gold-light">
            Manage your to-do lists and calendar events for {selectedClaim ? `case ${selectedClaim}` : 'your claims'}
          </p>
        </div>

        <div className="flex items-center gap-2 border-b border-yellow-400/20 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'todos' | 'calendar')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-yellow-400 text-gold'
                    : 'border-transparent text-gray-300 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="card-enhanced p-6 mb-6 w-full">
          <div className="flex items-center mb-6">
            <h2 className="text-2xl font-bold">
              {activeTab === 'todos' ? 'To-Do Lists' : 'Calendar Events'}
            </h2>
          </div>
          <div className="min-h-[400px]">
            {activeTab === 'todos' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2 min-w-0">
                  <TodoList 
                  selectedClaim={selectedClaim}
                  claimColor="#3B82F6"
                  isGuest={isGuest}
                  showGuestContent={isGuest}
                  isGuestFrozen={isGuestFrozen}
                  showNavigation={false}
                  />
                </div>
                <aside className="card-enhanced p-4 border-l-4 border-blue-400">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold">Upcoming Calendar Events</h3>
                  </div>
                  {upcomingEvents.length > 0 ? (
                    <div className="space-y-3 max-h-[520px] overflow-y-auto">
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className="p-3 rounded-lg border-l-4 bg-white/5" style={{ borderLeftColor: event.color || '#3B82F6' }}>
                          <div className="font-medium text-sm">{event.title}</div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {event.allDay ? format(event.startTime, 'EEE, MMM d') : format(event.startTime, 'EEE, MMM d, HH:mm')}
                          </div>
                          {event.description && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{event.description}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No upcoming calendar events.</p>
                  )}
                </aside>
              </div>
            )}

            {activeTab === 'calendar' && (
              <CalendarComponent 
                  selectedClaim={selectedClaim}
                  claimColor="#3B82F6"
                  isGuest={isGuest}
                  showGuestContent={isGuest}
                  isGuestFrozen={isGuestFrozen}
                  showNavigation={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Events
