import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Todo } from '@/types/database'
import { Plus, Check, Clock, AlertCircle, Trash2, User, Calendar as CalendarIcon, ChevronLeft, Home, X, ArrowLeft } from 'lucide-react'
import { useNavigation } from '@/contexts/NavigationContext'
import { format } from 'date-fns'

interface TodoWithUser extends Todo {
  profiles?: {
    email: string
  }
  claims?: {
    title: string
    status: string
  }
  responsible_user?: {
    id: string
    email: string
    full_name?: string
  }
}

interface TodoListProps {
  selectedClaim: string | null
  claimColor?: string
  isGuest?: boolean
  showGuestContent?: boolean
  isGuestFrozen?: boolean
}

const TodoList = ({ selectedClaim, claimColor = '#3B82F6', isGuest = false, showGuestContent = false, isGuestFrozen = false }: TodoListProps) => {
  const { navigateBack, navigateTo } = useNavigation()
  const [showAddForm, setShowAddForm] = useState(false)
  const [currentClaimColor, setCurrentClaimColor] = useState(claimColor)
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as const,
    alarm_enabled: false,
    alarm_time: '',
    case_number: selectedClaim || '',
    responsible_user_id: ''
  })

  const queryClient = useQueryClient()

  // Get current user for permission checks
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    }
  })

  // Disable alarm when guest assigns task to host
  useEffect(() => {
    if (isGuest && currentUser && newTodo.responsible_user_id !== currentUser.id && newTodo.alarm_enabled) {
      setNewTodo(prev => ({ ...prev, alarm_enabled: false, alarm_time: '' }))
    }
  }, [isGuest, currentUser, newTodo.responsible_user_id])

  const { data: todos, isLoading } = useQuery({
    queryKey: ['todos', selectedClaim, showGuestContent],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let query = supabase
        .from('todos')
        .select(`
          *,
          profiles:profiles!todos_user_id_profiles_fkey(email),
          responsible_user:profiles!todos_responsible_user_fk(id, email, full_name)
        `)
      
      if (isGuest) {
        // Shared view: when a claim is selected, show todos for that claim (host and guests per RLS)
        if (selectedClaim) {
          query = query.eq('case_number', selectedClaim)
        }
      } else {
        // Private view: show items created by me OR assigned to me across all claims
        query = query.or(`user_id.eq.${user.id},responsible_user_id.eq.${user.id}`)
      }
      
      const { data, error } = await query
        .order('case_number', { ascending: true })
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true })
      
      if (error) throw error
      if (showGuestContent) {
        console.log('Shared To-Dos query', {
          selectedClaim: selectedClaim || null,
          resultCount: (data || []).length
        })
      }
      return data as TodoWithUser[]
    }
  })

  const { data: claims } = useQuery({
    queryKey: ['claims-for-todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title, court, status')
        .neq('status', 'Closed')
        .order('title')
      if (error) throw error
      return data
    }
  })

  // Get shared users for responsible user dropdown (only in shared view)
  const { data: sharedUsers } = useQuery({
    queryKey: ['shared-users', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return []
      
      const { data, error } = await supabase
        .from('claim_shares')
        .select(`
          shared_with_id,
          profiles!shared_with_id(id, email, full_name)
        `)
        .eq('claim_id', selectedClaim)
      
      if (error) throw error
      const guests = data?.map(share => share.profiles).filter(Boolean) || []
      // Include host (claim owner) as assignable option
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
          const exists = guests.some((u: any) => u.id === ownerProfile.id)
          if (!exists) guests.unshift(ownerProfile as any)
        }
      }
      return guests
    },
    enabled: !!selectedClaim && showGuestContent
  })

  const { data: todayTodos } = useQuery({
    queryKey: ['today-todos', selectedClaim, showGuestContent],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayString = today.toISOString().split('T')[0]
      
      let query = supabase
        .from('todos')
        .select(`
          *,
          profiles:profiles!todos_user_id_profiles_fkey(email),
          responsible_user:profiles!todos_responsible_user_fk(id, email, full_name)
        `)
        .gte('due_date', todayString)
        .eq('completed', false)
      
      if (selectedClaim) {
        query = query.eq('case_number', selectedClaim)
      }
      
      // Filter based on view type
      if (showGuestContent) {
        // Show all todos for shared claim (regardless of who created or is assigned)
        // This is handled by the RLS policy for shared claims
      } else {
        // Show only todos created by the current user
        query = query.eq('user_id', user.id)
      }
      
      const { data, error } = await query
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return data as TodoWithUser[]
    }
  })

  const addTodoMutation = useMutation({
    mutationFn: async (todo: typeof newTodo) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Ensure alarm_time is null if not enabled or empty
      const nowStr = new Date().toISOString()
      const todoData = {
        ...todo,
        user_id: user.id,
        case_number: selectedClaim || todo.case_number || null,
        due_date: todo.due_date || nowStr,
        alarm_time: todo.alarm_enabled && todo.alarm_time ? todo.alarm_time : null
      }
      const { data, error } = await supabase
        .from('todos')
        .insert([{ ...todoData, responsible_user_id: todo.responsible_user_id || user.id }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim, showGuestContent] })
      setShowAddForm(false)
      setNewTodo({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium',
        alarm_enabled: false,
        alarm_time: '',
        case_number: selectedClaim || '',
        responsible_user_id: ''
      })
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
      queryClient.invalidateQueries({ queryKey: ['todos'] })
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
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.title.trim() || !newTodo.due_date) return
    addTodoMutation.mutate(newTodo)
  }

  // Update color when claim changes
  useEffect(() => {
    if (newTodo.case_number && claims) {
      const selectedClaimData = claims.find(c => c.case_number === newTodo.case_number)
      if (selectedClaimData) {
        // Use a default color scheme based on claim title or use the prop color
        setCurrentClaimColor(claimColor)
      }
    } else {
      setCurrentClaimColor(claimColor)
    }
  }, [newTodo.case_number, claims, claimColor])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading todos...</div>
  }

  return (
    <div className="space-y-6">
      
      
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
          {(!isGuest) || (showGuestContent && !isGuestFrozen) ? (
            <button
              onClick={() => {
              setNewTodo(prev => ({ ...prev, responsible_user_id: currentUser?.id || '' }))
              setShowAddForm(true)
            }}
              className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg hover:opacity-90 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New</span>
            </button>
          ) : null}
        </div>
        <h2 className="text-2xl font-bold flex-1" style={{ marginLeft: '90px' }}>To-Do Lists</h2>
        <div className="flex items-center space-x-3 justify-end" />
      </div>

      {showAddForm && (!isGuest || (showGuestContent && !isGuestFrozen)) ? (
        // Form overlay - hide main content
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-[16px] shadow max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'rgba(30, 58, 138, 0.9)', border: '2px solid #fbbf24' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Todo</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-white/10 border border-red-400 text-red-400 px-2 py-1 rounded flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-base font-medium mb-1">Title *</label>
              <input
                type="text"
                value={newTodo.title}
                onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                className="w-full h-12 text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-1">Description</label>
              <textarea
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                className="w-full text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-medium mb-1">Due Date *</label>
                <input
                  type="datetime-local"
                  value={newTodo.due_date}
                  onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                  className="w-full h-12 text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                  required
                />
              </div>
              <div>
                <label className="block text-base font-medium mb-1">Priority</label>
                <select
                  value={newTodo.priority}
                  onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="w-full h-12 text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="alarm"
                checked={newTodo.alarm_enabled}
                onChange={(e) => setNewTodo({ ...newTodo, alarm_enabled: e.target.checked })}
                disabled={isGuest && newTodo.responsible_user_id !== currentUser?.id}
                className="rounded disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor="alarm" className={`text-sm ${isGuest && newTodo.responsible_user_id !== currentUser?.id ? 'text-gray-400' : ''}`}>
                Enable alarm
                {isGuest && newTodo.responsible_user_id !== currentUser?.id && (
                  <span className="text-xs text-gray-500 ml-1">(Host only)</span>
                )}
              </label>
            </div>
            {newTodo.alarm_enabled && (!isGuest || newTodo.responsible_user_id === currentUser?.id) && (
              <div>
                <label className="block text-base font-medium mb-1">Alarm Time</label>
                <input
                  type="datetime-local"
                  value={newTodo.alarm_time}
                  onChange={(e) => setNewTodo({ ...newTodo, alarm_time: e.target.value })}
                  className="w-full h-12 text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                />
              </div>
            )}
            <div className="grid grid-cols-4 gap-2 items-end">
              <div className="col-span-2">
                <label className="block text-base font-medium mb-1">Associated Claim</label>
                <select
                  value={newTodo.case_number}
                  onChange={(e) => setNewTodo({ ...newTodo, case_number: e.target.value })}
                  className="w-2/3 h-12 text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                >
                  <option value="">No specific claim</option>
                  {claims?.map((claim) => (
                    <option key={claim.case_number} value={claim.case_number}>
                      {claim.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                {newTodo.case_number ? (
                  <div
                    className="w-8 h-8 rounded border"
                    style={{
                      backgroundColor: currentClaimColor,
                      borderColor: currentClaimColor
                    }}
                    title="Claim color"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded border"
                    title="Select a claim to set color"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(239,68,68,0.85) 0 10px, transparent 10px 20px)',
                      backgroundColor: 'rgba(239,68,68,0.15)',
                      borderColor: 'rgba(239,68,68,0.7)'
                    }}
                  />
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addTodoMutation.isPending}
                  className="bg-white/10 border border-green-400 text-green-400 px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {addTodoMutation.isPending ? 'Adding...' : 'Save'}
                </button>
              </div>
            </div>
            {showGuestContent && sharedUsers && sharedUsers.length > 0 && (
              <div>
                <label className="block text-base font-medium mb-1">Responsible User</label>
                <select
                  value={newTodo.responsible_user_id}
                  onChange={(e) => setNewTodo({ ...newTodo, responsible_user_id: e.target.value })}
                  className="w-2/3 h-12 text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                >
                  <option value="">Assign to yourself</option>
                  {sharedUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email} {user.id === newTodo.user_id ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form>
          </div>
        </div>
      ) : (
        // Main content when form is not open
        <>
          <div className="space-y-4 w-[44%]">
        {todos?.reduce((groups: { [key: string]: TodoWithUser[] }, todo) => {
          const claimKey = todo.case_number || 'No Claim'
          if (!groups[claimKey]) {
            groups[claimKey] = []
          }
          groups[claimKey].push(todo)
          return groups
        }, {}) && Object.entries(todos?.reduce((groups: { [key: string]: TodoWithUser[] }, todo) => {
          const claimKey = todo.case_number || 'No Claim'
          if (!groups[claimKey]) {
            groups[claimKey] = []
          }
          groups[claimKey].push(todo)
          return groups
        }, {}) || {}).map(([claimKey, claimTodos]) => {
          const claimData = claims?.find(c => c.case_number === claimKey)
          const claimColor = claimData?.color || '#6B7280'
          
          return (
            <div key={claimKey} className="space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: claimColor }}
                />
                <h3 className="text-lg font-semibold" style={{ color: claimColor }}>
                  {claimKey === 'No Claim' ? 'General Tasks' : `${claimKey}`}
                </h3>
                {claimKey !== 'No Claim' && claimTodos[0]?.claims?.title && (
                  <span className="text-sm" style={{ color: claimColor }}>- {claimTodos[0].claims.title}</span>
                )}
                <span className="text-sm" style={{ color: claimColor }}>({claimTodos.length} tasks)</span>
              </div>
              {claimTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`card-enhanced px-4 pt-4 pb-2 rounded-lg shadow border-l-4 ${
                    todo.completed ? 'opacity-75' : ''
                  }`}
                  style={{ borderLeftColor: claimColor }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <label className="flex items-center space-x-2 mt-1 cursor-pointer" title={todo.completed ? 'Mark as not completed' : 'Mark as completed'}>
                        <input
                          type="checkbox"
                          checked={!!todo.completed}
                          onChange={() => toggleTodoMutation.mutate({ id: todo.id, completed: !todo.completed })}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">Complete</span>
                      </label>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className={`font-medium ${todo.completed ? 'line-through text-gray-500' : ''}`}>
                            {todo.title}
                          </h3>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700 text-sm">{format(new Date(todo.due_date), 'MMM d, h:mm a')}</span>
                          </div>
                        </div>
                        {todo.description && (
                          <p className={`text-sm mt-1 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                            {todo.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <button
                        onClick={() => deleteTodoMutation.mutate(todo.id)}
                        className="text-red-600 hover:text-red-800 p-1 flex items-center space-x-1"
                        disabled={isGuest && (isGuestFrozen || todo.user_id !== currentUser?.id)}
                        title={
                          isGuest && isGuestFrozen 
                            ? 'Access frozen by claim owner'
                            : isGuest && todo.user_id !== currentUser?.id
                              ? 'You can only delete your own todos'
                              : 'Delete todo'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">Delete</span>
                      </button>
                    </div>
                  </div>
                  {/* User information row - aligned with left border */}
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <div className="flex items-center space-x-4">
                      {todo.responsible_user && (
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-700">Assigned to: {todo.responsible_user.full_name || todo.responsible_user.email}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">By: {todo.profiles?.email || 'Unknown user'}</span>
                      </div>
                      {todo.alarm_enabled && (
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="w-4 h-4" style={{ color: claimColor }} />
                          <span className="text-gray-700">Alarm set</span>
                        </div>
                      )}
                    </div>
                    {/* Priority value - right side of row 3 */}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(todo.priority)}`}>
                      {todo.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {(!todos || todos.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            No todos yet. Create your first todo to get started!
          </div>
        )}
          </div>
        </>
      )}
    </div>
  )
}

export default TodoList