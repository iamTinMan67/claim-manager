import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Todo } from '@/types/database'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { Plus, Clock, X, Check, User, AlertCircle, Trash2 } from 'lucide-react'

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

interface TodoWithUser extends Todo {
  profiles?: {
    email: string
  }
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
    color: claimColor,
    claim_id: selectedClaim || ''
  })

  const queryClient = useQueryClient()

  const { data: claims } = useQuery({
    queryKey: ['claims-for-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title, color')
        .order('title')
      
      if (error) throw error
      return data
    }
  })

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

  const { data: todayTodos } = useQuery({
    queryKey: ['today-todos-calendar', selectedClaim],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayString = today.toISOString().split('T')[0]
      
      let query = supabase
        .from('todos')
        .select(`
          *,
          profiles(email)
        `)
        .gte('due_date', todayString)
        .eq('completed', false)
      
      if (selectedClaim) {
        query = query.eq('case_number', selectedClaim)
      }
      
      const { data, error } = await query
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return data as TodoWithUser[]
    }
  })

  const addEventMutation = useMutation({
    mutationFn: async (event: typeof newEvent) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{ ...event, user_id: user.id, claim_id: event.claim_id || null }])
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
        color: claimColor,
        claim_id: selectedClaim || ''
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

  const toggleTodoMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string, completed: boolean }) => {
      const { data, error } = await supabase
        .from('todos')
        .update({ 
          completed,
          completed_at: completed ? new Date().toISOString() : null
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-todos-calendar'] })
    }
  })

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-todos-calendar'] })
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
    
    // Ensure end_time is set to start_time if empty
    const eventToSubmit = {
      ...newEvent,
      end_time: newEvent.end_time || newEvent.start_time
    }
    
    addEventMutation.mutate(eventToSubmit)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setNewEvent(prev => ({
      ...prev,
      start_time: format(date, "yyyy-MM-dd'T'HH:mm"),
      end_time: format(date, "yyyy-MM-dd'T'HH:mm"),
      claim_id: selectedClaim || ''
    }))
    setShowAddForm(true)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
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
            <div>
              <label className="block text-sm font-medium mb-1">Associated Claim</label>
              <select
                value={newEvent.claim_id}
                onChange={(e) => setNewEvent({ ...newEvent, claim_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">No specific claim</option>
                {claims?.map((claim) => (
                  <option key={claim.case_number} value={claim.case_number}>
                    {claim.case_number} - {claim.title}
                  </option>
                ))}
              </select>
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

      {/* Daily View with To-Do List and Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* To-Do List Section */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: claimColor }}>
              Today's Tasks & Upcoming
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {todayTodos && todayTodos.length > 0 ? (
                todayTodos.map((todo) => {
                  const dueDate = new Date(todo.due_date)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const isToday = dueDate.toDateString() === today.toDateString()
                  const isOverdue = dueDate < today
                  
                  return (
                    <div
                      key={todo.id}
                      className={`p-3 rounded border-l-2 ${
                        isOverdue ? 'bg-red-50 border-red-400' : 
                        isToday ? 'bg-yellow-50 border-yellow-400' : 
                        'bg-blue-50 border-blue-400'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-2 flex-1">
                          <button
                            onClick={() => toggleTodoMutation.mutate({ 
                              id: todo.id, 
                              completed: !todo.completed 
                            })}
                            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ${
                              todo.completed 
                                ? 'text-white' 
                                : 'border-gray-300'
                            }`}
                            style={todo.completed ? { 
                              backgroundColor: claimColor, 
                              borderColor: claimColor 
                            } : { 
                              borderColor: `${claimColor}50` 
                            }}
                          >
                            {todo.completed && <Check className="w-2 h-2" />}
                          </button>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{todo.title}</h4>
                            <div className="flex flex-col space-y-1 mt-1 text-xs text-gray-600">
                              <div className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{todo.profiles?.email || 'Unknown user'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{format(dueDate, 'MMM d, h:mm a')}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(todo.priority)}`}>
                                  {todo.priority}
                                </span>
                                {isOverdue && <span className="text-red-600 font-medium">OVERDUE</span>}
                                {isToday && <span className="text-yellow-600 font-medium">DUE TODAY</span>}
                                {todo.alarm_enabled && (
                                  <AlertCircle className="w-3 h-3" style={{ color: claimColor }} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTodoMutation.mutate(todo.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No upcoming tasks
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="lg:col-span-2">
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
      </div>
    </div>
  )
}

export default Calendar