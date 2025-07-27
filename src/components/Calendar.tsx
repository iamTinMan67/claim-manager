import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { Plus, Clock, X } from 'lucide-react'

interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  all_day: boolean
  color?: string
  claim_id?: string
  created_at: string
}

interface CalendarEventWithUser extends CalendarEvent {
  profiles?: {
    email: string
  }
}

interface CalendarProps {
  selectedClaim: string | null
  claimColor?: string
}

const Calendar = ({ selectedClaim, claimColor = '#3B82F6' }: CalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    all_day: false,
    color: claimColor
  })

  const queryClient = useQueryClient()

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', format(currentDate, 'yyyy-MM'), selectedClaim],
    queryFn: async () => {
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      
      let query = supabase
        .from('calendar_events')
        .select(`
          *,
          profiles!user_id(email)
        `)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
      
      if (selectedClaim) {
        query = query.eq('claim_id', selectedClaim)
      }
      
      const { data, error } = await query
        .order('start_time', { ascending: true })
      
      if (error) throw error
      return data as CalendarEventWithUser[]
    }
  })

  const addEventMutation = useMutation({
    mutationFn: async (event: typeof newEvent) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{ ...event, user_id: user.id }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      setShowAddForm(false)
      setNewEvent({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        all_day: false,
        color: claimColor
      })
    }
  })

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    }
  })

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getEventsForDay = (date: Date) => {
    return events?.filter(event => 
      isSameDay(new Date(event.start_time), date)
    ) || []
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvent.title.trim() || !newEvent.start_time) return
    
    if (!newEvent.end_time) {
      setNewEvent(prev => ({ ...prev, end_time: prev.start_time }))
    }
    
    addEventMutation.mutate(newEvent)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setNewEvent(prev => ({
      ...prev,
      start_time: format(date, "yyyy-MM-dd'T'HH:mm"),
      end_time: format(date, "yyyy-MM-dd'T'HH:mm")
    }))
    setShowAddForm(true)
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading calendar...</div>
  }

  return (
    <div className="space-y-6">
      {selectedClaim && (
        <div className="border-l-4 rounded-lg p-4" style={{ 
          borderLeftColor: claimColor,
          backgroundColor: `${claimColor}10`
        }}>
          <p style={{ color: claimColor }}>
            Showing calendar events for selected claim: <strong>{selectedClaim}</strong>
          </p>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Calendar</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            Previous
          </button>
          <h3 className="text-lg font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            Next
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-white px-4 py-2 rounded-lg hover:opacity-90 flex items-center space-x-2"
            style={{ backgroundColor: claimColor }}
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Add New Event</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                id="all-day"
                checked={newEvent.all_day}
                onChange={(e) => setNewEvent({ ...newEvent, all_day: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="all-day" className="text-sm">All day event</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time *</label>
                <input
                  type={newEvent.all_day ? "date" : "datetime-local"}
                  value={newEvent.start_time}
                  onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <input
                  type={newEvent.all_day ? "date" : "datetime-local"}
                  value={newEvent.end_time}
                  onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Color</label>
              <input
                type="color"
                value={newEvent.color || claimColor}
                onChange={(e) => setNewEvent({ ...newEvent, color: e.target.value })}
                className="w-16 h-10 border rounded-lg"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={addEventMutation.isPending}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                {addEventMutation.isPending ? 'Adding...' : 'Add Event'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {monthDays.map(date => {
            const dayEvents = getEventsForDay(date)
            return (
              <div
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                className={`bg-white p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 ${
                  isToday(date) ? 'bg-blue-50' : ''
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday(date) ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {format(date, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded truncate text-white relative group"
                     style={{ backgroundColor: event.color || claimColor }}
                    >
                      <div>{event.title}</div>
                      {event.profiles?.email && (
                        <div className="text-xs opacity-75">
                          by {event.profiles.email.split('@')[0]}
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteEventMutation.mutate(event.id)
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Calendar