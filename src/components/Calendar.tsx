import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Todo } from '@/types/database'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { Plus, Clock, X, Check, User, AlertCircle, Trash2, Filter, Bell, Home, ArrowLeft, Edit } from 'lucide-react'
import { useNavigation } from '@/contexts/NavigationContext'

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
  // Profile data removed to fix 400 errors
  assignee?: {
    email: string
  }
}

interface CalendarProps {
  selectedClaim: string | null
  claimColor?: string
  isGuest?: boolean
  showGuestContent?: boolean
  isGuestFrozen?: boolean
}

interface TodoWithUser extends Todo {
  creator_profile?: {
    email: string
    nickname?: string
  }
  assignee_profile?: {
    email: string
    nickname?: string
  }
}

const Calendar = ({ selectedClaim, claimColor = '#3B82F6', isGuest = false, showGuestContent = false, isGuestFrozen = false }: CalendarProps) => {
  const { navigateBack, navigateTo, canGoBack } = useNavigation()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterByActiveClaim, setFilterByActiveClaim] = useState(false)
  const [activeAlarm, setActiveAlarm] = useState<TodoWithUser | null>(null)
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    all_day: false,
    color: claimColor,
    claim_id: selectedClaim || ''
  })

  // Update newEvent when selectedClaim or claimColor changes
  React.useEffect(() => {
    setNewEvent(prev => ({
      ...prev,
      claim_id: selectedClaim || '',
      color: claimColor
    }))
  }, [selectedClaim, claimColor])

  const queryClient = useQueryClient()
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const timeFieldWidth = 180
  const titleFieldWidth = timeFieldWidth
  const colorFieldWidth = Math.round(timeFieldWidth * 0.2)

  // Get current user for permission checks
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-calendar'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    }
  })

  // (moved) Check for due alarms effect is placed after todayTodos query to avoid TDZ errors

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Ensure calendar controls are at the top on shared view load
  useEffect(() => {
    if (showGuestContent && controlsRef.current) {
      controlsRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }, [showGuestContent])

  const { data: claims } = useQuery({
    queryKey: ['claims-for-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title, color, status, court')
        .order('title')
      if (error) throw error
      return data
    }
  })

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', format(currentDate, 'yyyy-MM'), selectedClaim, showGuestContent],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

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
      
      if (isGuest) {
        // Shared: filter to selected claim and other users' events
        if (selectedClaim) {
          query = query.eq('claim_id', selectedClaim)
        }
        query = query.neq('user_id', user.id)
      } else {
        // Private: show events I created across all claims
        query = query.eq('user_id', user.id)
      }
      
      const { data, error } = await query
        .order('start_time', { ascending: true })
      
      if (error) throw error
      console.log('Calendar: Events query result', {
        selectedClaim: selectedClaim || null,
        showGuestContent,
        resultCount: (data || []).length,
        events: data || []
      })
      return data as CalendarEventWithUser[]
    }
  })

  // Load collaborators for selected claim (for Shared calendar assignee selector)
  const { data: collaborators } = useQuery({
    queryKey: ['claim-collaborators', selectedClaim],
    enabled: Boolean(selectedClaim),
    queryFn: async () => {
      if (!selectedClaim) return [] as { id: string, email: string, full_name?: string | null }[]
      const { data, error } = await supabase
        .from('claim_shares')
        .select('shared_with_id, profiles:shared_with_id(email, full_name)')
        .eq('claim_id', selectedClaim)
      if (error) throw error
      const list = (data || []).map((row: any) => ({
        id: row.shared_with_id as string,
        email: row.shared_with_id as string,
        full_name: row.shared_with_id as string
      }))
      // Include host (claim owner) as potential assignee
      const { data: claimOwner } = await supabase
        .from('claims')
        .select('user_id')
        .eq('case_number', selectedClaim)
        .maybeSingle()
      if (claimOwner?.user_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', claimOwner.user_id)
          .maybeSingle()
        if (ownerProfile) {
          const exists = list.some((u: any) => u.id === ownerProfile.id)
          if (!exists) list.unshift(ownerProfile as any)
        }
      }
      return list
    }
  })

  const { data: todayTodos } = useQuery({
    queryKey: ['today-todos-calendar', selectedClaim],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayString = today.toISOString().split('T')[0]
      console.log('Today string for query:', todayString)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      console.log('User ID for query:', user.id)

      let query = supabase
        .from('todos')
        .select(`
          *,
          creator_profile:profiles!user_id(email, nickname),
          assignee_profile:profiles!responsible_user_id(email, nickname)
        `)
        .gte('due_date', todayString)
        .eq('completed', false)
      
      if (isGuest || showGuestContent) {
        // Shared: scope to selected claim
        if (selectedClaim) {
          query = query.eq('case_number', selectedClaim)
        }
      } else {
        // Private: show my tasks or tasks assigned to me across all claims
        query = query.or(`user_id.eq.${user.id},responsible_user_id.eq.${user.id}`)
      }
      
      const { data, error } = await query
        .order('due_date', { ascending: true })
      
      if (error) {
        console.error('Todo query error:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }
      console.log('Calendar: Today todos query result', {
        selectedClaim: selectedClaim || null,
        resultCount: (data || []).length,
        todos: data || []
      })
      return data as TodoWithUser[]
    }
  })

  // Check for due alarms (must be after todayTodos declaration)
  useEffect(() => {
    const checkAlarms = () => {
      if (!currentUser) return;
      const now = new Date();
      const todosToCheck = todayTodos || [];
      const dueAlarms = todosToCheck.filter(todo =>
        !todo.completed &&
        todo.alarm_enabled &&
        todo.alarm_time &&
        new Date(todo.alarm_time) <= now &&
        !activeAlarm
      );
      if (dueAlarms.length > 0 && !activeAlarm) {
        setActiveAlarm(dueAlarms[0]);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Task Alarm: ${dueAlarms[0].title}`, {
            body: dueAlarms[0].description || 'You have a task alarm.',
            icon: '/favicon.ico'
          });
        }
      }
    };
    const interval = setInterval(checkAlarms, 30000);
    checkAlarms();
    return () => clearInterval(interval);
  }, [todayTodos, currentUser, activeAlarm]);

  const addEventMutation = useMutation({
    mutationFn: async (event: typeof newEvent) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{ 
          ...event, 
          user_id: user.id, 
          claim_id: event.claim_id || null
        }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate all calendar and todo queries for cross-view synchronization
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
      queryClient.invalidateQueries({ queryKey: ['today-todos-calendar'] })
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
    },
    onError: (err: any) => {
      console.error('Add event failed:', err)
      alert(`Failed to add event: ${err?.message || 'Unknown error'}`)
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
      // Invalidate all calendar and todo queries for cross-view synchronization
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
      queryClient.invalidateQueries({ queryKey: ['today-todos-calendar'] })
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
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
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
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
    }
  })

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getEventsForDay = (date: Date) => {
    return events?.filter(event => isSameDay(new Date(event.start_time), date)) || []
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvent.title.trim()) return
    const nowStr = format(new Date(), "yyyy-MM-dd'T'HH:mm")
    
    // Ensure end_time is set to start_time if empty
    const eventToSubmit = {
      ...newEvent,
      start_time: newEvent.start_time || nowStr,
      end_time: newEvent.end_time || newEvent.start_time || nowStr
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
      {/* Sticky Navigation Controls */}
      <div className="sticky top-0 z-20 backdrop-blur-sm border-b border-yellow-400/20 p-4 -mx-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                sessionStorage.setItem('welcome_seen_session', '1')
                navigateBack()
              }}
              className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2 hover:opacity-90"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem('welcome_seen_session', '1')
                navigateTo(isGuest ? 'shared' : 'claims')
              }}
              className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2 hover:opacity-90"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            {(!isGuest) || (isGuest && !isGuestFrozen) ? (
              <button
                onClick={() => {
                  const now = new Date()
                  const nowStr = format(now, "yyyy-MM-dd'T'HH:mm")
                  setNewEvent(prev => ({
                    ...prev,
                    start_time: nowStr,
                    end_time: nowStr,
                    claim_id: selectedClaim || '',
                    color: selectedClaim ? claimColor : prev.color,
                    assignee_id: currentUser?.id
                  }))
                  setShowAddForm(true)
                }}
                className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg hover:opacity-90 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add New</span>
              </button>
            ) : null}
          </div>
          
          {/* Calendar Navigation Controls - True Center */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="px-3 py-1 border rounded hover:bg-yellow-400/20 text-gold"
              >
                Previous
              </button>
              <h3 className="text-lg font-semibold">
                {format(currentDate, 'MMMM yyyy')}
              </h3>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="px-3 py-1 border rounded hover:bg-yellow-400/20 text-gold"
              >
                Next
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 justify-end">
            {/* Empty space for balance */}
          </div>
        </div>
      </div>

      {showAddForm && (
        // Form overlay - hide main content
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-[16px] shadow max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'rgba(30, 58, 138, 0.9)', border: '2px solid #fbbf24' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Add New Event</h3>
            <button
              onClick={() => setShowAddForm(false)}
                className="bg-white/10 border border-red-400 text-red-400 px-2 py-1 rounded hover:opacity-90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid items-end gap-4" style={{ display: 'grid', gridTemplateColumns: `${timeFieldWidth}px ${timeFieldWidth}px ${colorFieldWidth}px` }}>
            <div>
                <label className="block text-base font-medium mb-1">Title</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Enter event title"
                className="h-[27px] mr-2 border border-yellow-400/30 rounded-md px-2 bg-white/10 text-yellow-300 placeholder-yellow-300/70 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                style={{ width: timeFieldWidth }}
                required
              />
            </div>
            <div>
                <label className="block text-base font-medium mb-1">Associated Claim</label>
                <select
                  value={newEvent.claim_id}
                  onChange={(e) => {
                    const claimId = e.target.value
                    const selected = (claims as any[] | undefined)?.find(c => c.case_number === claimId)
                    setNewEvent({
                      ...newEvent,
                      claim_id: claimId,
                      color: selected?.color || newEvent.color || claimColor
                    })
                  }}
                  className="h-[27px] text-sm border border-yellow-400/30 rounded-md px-2 bg-white/10 text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                  style={{ width: timeFieldWidth }}
                >
                  <option value="">Select A Claim</option>
                  {claims?.filter((c: any) => c.status !== 'Closed').map((claim) => (
                    <option key={claim.case_number} value={claim.case_number}>
                      {claim.court || '—'}
                    </option>
                  ))}
                </select>
            </div>
              <div style={{ marginLeft: 35 }}>
                <label className="block text-base font-medium mb-1 whitespace-nowrap" style={{ width: colorFieldWidth, textAlign: 'center' }}>{newEvent.claim_id ? 'Colour Code' : 'No Claim'}</label>
                {newEvent.claim_id ? (
              <input
                    type="color"
                    value={newEvent.color || claimColor}
                    onChange={(e) => setNewEvent({ ...newEvent, color: e.target.value })}
                    className="h-[27px] border rounded-md"
                    style={{ width: colorFieldWidth }}
                    title="Event color"
                  />
                ) : (
                  <div
                    className="h-[27px] border rounded-md"
                    style={{ width: colorFieldWidth, backgroundImage: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.85) 0 10px, transparent 10px 20px)', backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.7)' }}
                    title="Select a claim to set color"
                  />
                )}
              </div>
            </div>
            {/* Second row: Start Time (col 1), End Time (col 2), All day (col 3) */}
            <div className="w-1/2 grid items-end" style={{ display: 'grid', gridTemplateColumns: `${timeFieldWidth}px ${timeFieldWidth}px 120px`, columnGap: '1rem' }}>
              <div>
                <label className="block text-base font-medium mb-1">Start Time</label>
                <input
                  type={newEvent.all_day ? "date" : "datetime-local"}
                  value={newEvent.start_time}
                  onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  className="h-[27px] border border-yellow-400/30 rounded-md px-2 bg-white/10 text-yellow-300 text-sm placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                  style={{ width: timeFieldWidth }}
                  required
                />
              </div>
              <div>
                <label className="block text-base font-medium mb-1">End Time</label>
                <input
                  type={newEvent.all_day ? "date" : "datetime-local"}
                  value={newEvent.end_time}
                  onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                  className="h-[27px] border border-yellow-400/30 rounded-md px-2 bg-white/10 text-yellow-300 text-sm placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                  style={{ width: timeFieldWidth }}
                />
            </div>
            <div>
                <label className="block text-base font-medium mb-1 whitespace-nowrap text-center">All day</label>
                <div className="h-[27px] flex items-center justify-center">
              <input
                    type="checkbox"
                    id="all-day"
                    checked={newEvent.all_day}
                    onChange={(e) => setNewEvent({ ...newEvent, all_day: e.target.checked })}
                    className="rounded"
              />
            </div>
              </div>
            </div>
            <div className="w-1/2 grid grid-cols-2 items-end">
              {showGuestContent && (
            <div>
                  <label className="block text-base font-medium mb-1">Assignee</label>
              <select
                    value={newEvent.assignee_id || currentUser?.id || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, assignee_id: e.target.value })}
                    className="h-[27px] text-sm border border-yellow-400/30 rounded-md px-2 bg-white/10 text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                    style={{ width: timeFieldWidth }}
                  >
                    <option value={currentUser?.id || ''}>Assign to yourself</option>
                    {(collaborators || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email || 'User'}
                  </option>
                ))}
              </select>
            </div>
              )}
              <div className="flex w-full items-end justify-end mr-2">
                <div className="flex space-x-3 ml-4" style={{ marginRight: -50 }}>
              <button
                type="submit"
                disabled={addEventMutation.isPending}
                    className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {addEventMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
              </div>
            </div>
            
            
          </form>
          </div>
        </div>
      )}



      {/* Daily View with To-Do List and Calendar - Hide when form is open */}
      {!showAddForm && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* To-Do List Section */}
        <div className="lg:col-span-1">
          <div className="card-enhanced p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
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
                        isOverdue ? 'card-smudge border-red-400' : 
                        isToday ? 'card-smudge border-yellow-400' : 
                        'card-smudge border-blue-400'
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
                            <div className="flex flex-col space-y-2 mt-1 text-xs text-gray-600">
                              
                              {/* Row 1: Due date and status */}
                              <div className="flex items-center space-x-2">
                                <Clock className="w-3 h-3" />
                                <span>{format(dueDate, 'MMM d, h:mm a')}</span>
                                {isOverdue && <span className="text-red-600 font-medium">OVERDUE</span>}
                                {isToday && <span className="text-yellow-600 font-medium">DUE TODAY</span>}
                                {todo.alarm_enabled && (
                                  <AlertCircle className="w-3 h-3" style={{ color: claimColor }} />
                                )}
                              </div>
                              
                              {/* Row 2: User assignments - more space */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-8">
                                  <div className="flex items-center space-x-2">
                                    <User className="w-3 h-3" />
                                    <span>By: {todo.creator_profile?.nickname || todo.creator_profile?.email || todo.user_id?.slice(0, 8)}...</span>
                                  </div>
                                  {todo.responsible_user_id && (
                                    <div className="flex items-center space-x-2">
                                      <User className="w-3 h-3 text-blue-400" />
                                      <span className="text-blue-600">Assigned to: {todo.assignee_profile?.nickname || todo.assignee_profile?.email || todo.responsible_user_id?.slice(0, 8)}...</span>
                                    </div>
                                  )}
                                </div>
                                {/* Alarm indicator - last position (right side) */}
                                {todo.alarm_enabled && (
                                  <div className="flex items-center space-x-1">
                                    <AlertCircle className="w-3 h-3" style={{ color: claimColor }} />
                                    <span className="text-gray-700">Alarm set</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Row 3: Edit button and Priority - below user info */}
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    // Edit functionality - placeholder for now
                                    console.log('Edit todo:', todo.id)
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1 flex items-center space-x-1"
                                  title="Edit todo"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span className="text-xs">Edit</span>
                                </button>
                                <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(todo.priority)}`}>
                                  {todo.priority}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <button
                            onClick={() => {
                              // Edit functionality - placeholder for now
                              console.log('Edit todo:', todo.id)
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1 flex items-center space-x-1 mr-8"
                            title="Edit todo"
                          >
                            <Edit className="w-3 h-3" />
                            <span className="text-xs">Edit</span>
                          </button>
                          <button
                            onClick={() => deleteTodoMutation.mutate(todo.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
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
          <div className="card-enhanced rounded-lg shadow">
            <div className="grid grid-cols-7 gap-px bg-yellow-400/20">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-yellow-400/30 p-2 text-center text-sm font-medium text-gold">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-yellow-400/20">
              {monthDays.map(date => {
                const dayEvents = getEventsForDay(date)
                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={`card-enhanced p-2 min-h-[100px] cursor-pointer hover:bg-yellow-400/10 ${
                      isToday(date) ? 'bg-yellow-400/20' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday(date) ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {format(date, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map(event => {
                        // Color coding:
                        // - Private (own events): purple (#7C3AED)
                        // - Shared (others' events): green (#10B981)
                        // - Fallback/use event.color/claimColor for custom
                        const isOwn = event.user_id === currentUser?.id
                        const bg = event.color
                          ? event.color
                          : isOwn && !showGuestContent
                            ? '#7C3AED'
                            : showGuestContent
                              ? '#10B981'
                              : claimColor
                        return (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded truncate text-white relative group"
                          style={{ backgroundColor: bg }}
                        >
                          <div>{event.title}</div>
                          <div className="text-xs opacity-75">
                            by {event.user_id?.slice(0, 8)}...
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                             if (isGuest && isGuestFrozen) {
                               alert('Your access has been frozen by the claim owner.')
                               return
                             }
                             if (isGuest && event.user_id !== currentUser?.id) {
                               alert('You can only delete events that you created.')
                                return
                              }
                              if (window.confirm('Are you sure you want to delete this event?')) {
                                deleteEventMutation.mutate(event.id)
                              }
                            }}
                            className={`absolute -top-1 -right-1 w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center ${
                             (isGuest && (isGuestFrozen || event.user_id !== currentUser?.id)) ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
                            } text-white`}
                           disabled={isGuest && (isGuestFrozen || event.user_id !== currentUser?.id)}
                           title={
                             isGuest && isGuestFrozen
                               ? 'Access frozen by claim owner'
                               : isGuest && event.user_id !== currentUser?.id
                                 ? 'You can only delete your own events'
                                 : 'Delete event'
                           }
                          >
                            <X className="w-2 h-2" />
                          </button>
                        </div>
                      )})}
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
      )}
    </div>
  )
}

export default Calendar