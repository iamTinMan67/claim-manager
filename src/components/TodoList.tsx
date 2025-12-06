import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Todo } from '@/types/database'
import { Plus, Check, Clock, AlertCircle, Trash2, User, Calendar as CalendarIcon, ChevronLeft, Home, X, ArrowLeft, Edit } from 'lucide-react'
import { useNavigation } from '@/contexts/NavigationContext'
import { format } from 'date-fns'
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils'

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

interface TodoListProps {
  selectedClaim: string | null
  claimColor?: string
  isGuest?: boolean
  showGuestContent?: boolean
  isGuestFrozen?: boolean
  showNavigation?: boolean
}

const TodoList = ({ selectedClaim, claimColor = '#3B82F6', isGuest = false, showGuestContent = false, isGuestFrozen = false, showNavigation = true }: TodoListProps) => {
  const { navigateBack, navigateTo } = useNavigation()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoWithUser | null>(null)
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
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})

  const queryClient = useQueryClient()

  // Auto-complete functionality - load saved form data
  const loadFormData = () => {
    const savedData = localStorage.getItem('todoFormData')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setNewTodo(prev => ({ ...prev, ...parsed, case_number: selectedClaim || prev.case_number }))
      } catch (error) {
        console.error('Error loading form data:', error)
      }
    }
  }

  // Save form data to localStorage
  const saveFormData = (data: typeof newTodo) => {
    const dataToSave = {
      title: data.title,
      description: data.description,
      priority: data.priority
    }
    localStorage.setItem('todoFormData', JSON.stringify(dataToSave))
  }

  // Load form data when component mounts
  React.useEffect(() => {
    loadFormData()
  }, [])

  // Clear error when user starts typing
  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

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
          creator_profile:profiles!user_id(email, nickname),
          assignee_profile:profiles!responsible_user_id(email, nickname)
        `)
      
      if (isGuest) {
        // Shared view: when a claim is selected, show todos for that claim (host and guests per RLS)
        if (selectedClaim) {
          query = query.eq('case_number', selectedClaim)
        }
      } else {
        // Private view: only show items assigned to me (not items I created for others)
        query = query.eq('responsible_user_id', user.id)
      }
      
      const { data, error } = await query
        .order('case_number', { ascending: true })
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true })
      
      if (error) throw error
      console.log('TodoList: Query result', {
        selectedClaim: selectedClaim || null,
        showGuestContent,
        resultCount: (data || []).length,
        todos: data || []
      })
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

  // Get all participants (host + guests) for responsible user dropdown (only in shared view)
  const { data: sharedUsers } = useQuery({
    queryKey: ['shared-users', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return []
      
      try {
        // Simple approach: get host first
        const { data: hostData, error: hostError } = await supabase
          .from('claims')
          .select('user_id')
          .eq('case_number', selectedClaim)
          .maybeSingle()
        
        if (hostError) {
          console.error('Host query error:', hostError)
          throw hostError
        }
        if (!hostData) {
          console.log('No host data found for claim:', selectedClaim)
          return []
        }
        
        // Get host profile
        const { data: hostProfile, error: hostProfileError } = await supabase
          .from('profiles')
          .select('id, email, nickname')
          .eq('id', hostData.user_id)
          .maybeSingle()
        
        if (hostProfileError) {
          console.error('Host profile error:', hostProfileError)
          throw hostProfileError
        }
        
        // Get guests
        const claimId = await getClaimIdFromCaseNumber(selectedClaim)
        if (!claimId) {
          console.error('Could not find claim_id for case_number:', selectedClaim)
          return []
        }
        
        const { data: guestsData, error: guestsError } = await supabase
          .from('claim_shares')
          .select('shared_with_id, profiles:shared_with_id(id, email, nickname, full_name)')
          .eq('claim_id', claimId)
        
        if (guestsError) {
          console.error('Guests query error:', guestsError)
          throw guestsError
        }
        
        // Get guest profiles from the joined data
        const guestProfiles = (guestsData || []).map((share: any) => {
          const profile = share.profiles
          return {
            id: profile?.id || share.shared_with_id,
            email: profile?.email || '',
            nickname: profile?.nickname || null,
            full_name: profile?.full_name || profile?.nickname || profile?.email || ''
          }
        }).filter((profile: any) => profile.id) // Filter out any invalid profiles
        
        const participants = []
        
        // Add host first
        if (hostProfile) {
          participants.push({
            id: hostProfile.id,
            email: hostProfile.email,
            nickname: hostProfile.nickname || null,
            full_name: hostProfile.nickname || hostProfile.email || ''
          })
        }
        
        // Add guests
        participants.push(...guestProfiles)
        
        console.log('Shared users query result:', {
          selectedClaim,
          hostProfile,
          guestProfiles,
          participants
        })
        
        return participants
      } catch (error) {
        console.error('Shared users query failed:', error)
        throw error
      }
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
        .select('*')
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
        // Private view: only show todos assigned to me (not todos I created for others)
        query = query.eq('responsible_user_id', user.id)
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
      // Invalidate all todo queries for this claim, regardless of guest/host view
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
      queryClient.invalidateQueries({ queryKey: ['today-todos-calendar'] })
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
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
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
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
      queryClient.invalidateQueries({ queryKey: ['today-todos-calendar'] })
    }
  })

  const updateTodoMutation = useMutation({
    mutationFn: async (updatedTodo: Partial<Todo> & { id: string }) => {
      const { error } = await supabase
        .from('todos')
        .update(updatedTodo)
        .eq('id', updatedTodo.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todos', selectedClaim] })
      queryClient.invalidateQueries({ queryKey: ['today-todos'] })
      queryClient.invalidateQueries({ queryKey: ['today-todos-calendar'] })
      setEditingTodo(null)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous errors
    setFormErrors({})
    
    // Validate required fields
    const errors: {[key: string]: string} = {}
    
    if (!newTodo.title.trim()) {
      errors.title = 'Title is required'
    }
    
    if (!newTodo.due_date) {
      errors.due_date = 'Due Date is required'
    }
    
    // If there are validation errors, set them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    
    addTodoMutation.mutate(newTodo)
    
    // Save form data for auto-complete
    saveFormData(newTodo)
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
    <div className="space-y-6 min-h-[75vh]">
      
      
      {showNavigation && (
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
            <button
              onClick={() => {
              console.log('Add New clicked, currentUser:', currentUser?.id)
              setNewTodo(prev => ({ ...prev, responsible_user_id: currentUser?.id || '' }))
              setShowAddForm(true)
            }}
              className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg hover:opacity-90 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New</span>
            </button>
          </div>
          <h2 className="text-2xl font-bold flex-1" style={{ marginLeft: '90px' }}>To-Do Lists</h2>
          <div className="flex items-center space-x-3 justify-end" />
        </div>
      )}

      {!showNavigation && (
        <div className="mb-4">
          <h2 className="text-2xl font-bold">To-Do Lists</h2>
          <div className="mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              console.log('Add New clicked, currentUser:', currentUser?.id)
                console.log('Setting showAddForm to true')
              setNewTodo(prev => ({ ...prev, responsible_user_id: currentUser?.id || '' }))
              setShowAddForm(true)
                console.log('showAddForm should now be true')
            }}
              className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg hover:opacity-90 flex items-center space-x-2 cursor-pointer"
              style={{ pointerEvents: 'auto' }}
            >
              <Plus className="w-4 h-4" />
              <span>Add New</span>
            </button>
          </div>
        </div>
      )}

      {showAddForm ? (
        // Form overlay - hide main content
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowAddForm(false)
          }
        }}>
          <div className="p-6 rounded-[16px] shadow max-w-2xl w-full max-h-[95vh] overflow-y-auto relative z-[10000]"
            style={{ backgroundColor: 'rgba(30, 58, 138, 0.9)', border: '2px solid #fbbf24', zIndex: 10000 }} onClick={(e) => e.stopPropagation()}>
            {console.log('Modal is rendering - showAddForm is true')}
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
                onChange={(e) => {
                  const updated = { ...newTodo, title: e.target.value }
                  setNewTodo(updated)
                  clearError('title')
                  saveFormData(updated)
                }}
                className={`w-full h-12 text-base border rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 ${
                  formErrors.title
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400/20'
                }`}
                required
              />
              {formErrors.title && (
                <p className="text-red-400 text-sm mt-1">{formErrors.title}</p>
              )}
            </div>
            <div>
              <label className="block text-base font-medium mb-1">Description</label>
              <textarea
                value={newTodo.description}
                onChange={(e) => {
                  const updated = { ...newTodo, description: e.target.value }
                  setNewTodo(updated)
                  saveFormData(updated)
                }}
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
                  onChange={(e) => {
                    setNewTodo({ ...newTodo, due_date: e.target.value })
                    clearError('due_date')
                  }}
                  className={`w-full h-12 text-base border rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 ${
                    formErrors.due_date
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400/20'
                  }`}
                  required
                />
                {formErrors.due_date && (
                  <p className="text-red-400 text-sm mt-1">{formErrors.due_date}</p>
                )}
              </div>
              <div>
                <label className="block text-base font-medium mb-1">Priority</label>
                <select
                  value={newTodo.priority}
                  onChange={(e) => {
                    const updated = { ...newTodo, priority: e.target.value as 'low' | 'medium' | 'high' }
                    setNewTodo(updated)
                    saveFormData(updated)
                  }}
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
                    title="Choose a Claim to set color"
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
              <div>
                <label className="block text-base font-medium mb-1">Responsible User</label>
                <select
                  value={newTodo.responsible_user_id}
                  onChange={(e) => setNewTodo({ ...newTodo, responsible_user_id: e.target.value })}
                  className="w-2/3 h-12 text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                >
                <option value={currentUser?.id || ''}>Assign to yourself</option>
                {sharedUsers && sharedUsers.length > 0 ? (
                  sharedUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email} {user.id === currentUser?.id ? '(You)' : ''}
                    </option>
                  ))
                ) : (
                  currentUser && (
                    <option value={currentUser.id}>
                      {currentUser.email} (You)
                    </option>
                  )
                )}
                </select>
              </div>
          </form>
          </div>
        </div>
      ) : !editingTodo ? (
        // Main content when form is not open and not editing
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
                        <div className="flex items-center">
                          <h3 className={`font-medium ${todo.completed ? 'line-through text-gray-500' : ''}`}>
                            {todo.title}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-1 mt-1">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 text-sm">{format(new Date(todo.due_date), 'MMM d, h:mm a')}</span>
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
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTodo(todo)
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1 flex items-center space-x-1"
                        disabled={isGuest && (isGuestFrozen || todo.user_id !== currentUser?.id)}
                        title={
                          isGuest && isGuestFrozen 
                            ? 'Access frozen by claim owner'
                            : isGuest && todo.user_id !== currentUser?.id
                              ? 'You can only edit your own todos'
                              : 'Edit todo'
                        }
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm">Edit</span>
                      </button>
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
                      {/* Priority value - below edit icon */}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(todo.priority)}`}>
                        {todo.priority}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: User information - more space for names */}
                  <div className="flex items-center justify-between mt-3 text-sm">
                    <div className="flex items-center space-x-10">
                      {todo.responsible_user_id && (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-700">Assigned to: {todo.assignee_profile?.nickname || todo.assignee_profile?.email || todo.responsible_user_id?.slice(0, 8)}...</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">By: {todo.creator_profile?.nickname || todo.creator_profile?.email || todo.user_id?.slice(0, 8)}...</span>
                      </div>
                    </div>
                    {/* Alarm indicator - last position (right side) */}
                    {todo.alarm_enabled && (
                      <div className="flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4" style={{ color: claimColor }} />
                        <span className="text-gray-700">Alarm set</span>
                      </div>
                    )}
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
      ) : null}

      {/* Edit Todo Modal */}
      {editingTodo && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="card-enhanced p-6 max-w-2xl w-full max-h-[100vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gold">Edit Task</h3>
              <button
                onClick={() => setEditingTodo(null)}
                className="bg-white/10 border border-red-400 text-red-400 px-3 py-1 rounded-lg flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const updatedTodo = {
                id: editingTodo.id,
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                due_date: formData.get('due_date') as string,
                priority: formData.get('priority') as 'low' | 'medium' | 'high',
                alarm_enabled: formData.get('alarm_enabled') === 'on',
                alarm_time: formData.get('alarm_time') as string,
                responsible_user_id: formData.get('responsible_user_id') as string
              }
              updateTodoMutation.mutate(updatedTodo)
            }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    name="title"
                    defaultValue={editingTodo.title}
                    className="w-full h-8 text-base border border-yellow-400/30 rounded-md px-4 py-2 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 text-left"
                    required
                  />
                </div>
                <div>
                  <label className="block text-base font-medium mb-1">Due Date *</label>
                  <input
                    type="datetime-local"
                    name="due_date"
                    defaultValue={editingTodo.due_date ? new Date(editingTodo.due_date).toISOString().slice(0, 16) : ''}
                    className="w-full h-8 text-base border border-yellow-400/30 rounded-md px-4 py-2 bg-white/10 text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 text-left"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    defaultValue={editingTodo.description || ''}
                    className="w-full text-base border border-yellow-400/30 rounded-md px-4 py-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 text-left align-top"
                    rows={2}
                    style={{ textAlign: 'left', verticalAlign: 'top' }}
                  />
                </div>
                <div>
                  <label className="block text-base font-medium mb-1">Priority</label>
                  <select
                    name="priority"
                    defaultValue={editingTodo.priority}
                    className="w-[50%] h-12 text-base border border-yellow-400/30 rounded-md px-4 py-2 bg-white/10 text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 text-left"
                    style={{ textAlign: 'left' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="alarm_enabled"
                    defaultChecked={editingTodo.alarm_enabled}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-yellow-300">Enable Alarm</span>
                </label>
                {editingTodo.alarm_enabled && (
                  <input
                    type="datetime-local"
                    name="alarm_time"
                    defaultValue={editingTodo.alarm_time ? new Date(editingTodo.alarm_time).toISOString().slice(0, 16) : ''}
                    className="h-8 text-base border border-yellow-400/30 rounded-md px-4 py-2 bg-white/10 text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 text-left"
                  />
                )}
              </div>
              <div>
                <label className="block text-base font-medium mb-1">Assigned To</label>
                <select
                  name="responsible_user_id"
                  defaultValue={editingTodo.responsible_user_id || currentUser?.id || ''}
                  className="w-[50%] h-12 text-base border border-yellow-400/30 rounded-md px-4 py-2 bg-white/10 text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 text-left"
                  style={{ textAlign: 'left' }}
                >
                  {showGuestContent && sharedUsers && sharedUsers.length > 0 ? (
                    sharedUsers.map((user, index) => {
                      // The first user in sharedUsers is always the host (claim owner)
                      const isHost = index === 0
                      const displayName = user.nickname || user.email
                      
                      // Debug logging
                      console.log('Dropdown user data:', {
                        user: user,
                        index: index,
                        isHost: isHost,
                        displayName: displayName,
                        nickname: user.nickname,
                        email: user.email
                      })
                      
                      return (
                        <option key={user.id} value={user.id}>
                          {isHost ? 'Host' : `Guest ${index}`}: {displayName}
                        </option>
                      )
                    })
                  ) : (
                    <option value={currentUser?.id || ''}>
                      Host: {currentUser?.email || 'You'}
                    </option>
                  )}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingTodo(null)}
                  className="flex-1 bg-white/10 border border-red-400 text-red-400 px-6 py-3 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-white/10 border border-green-400 text-green-400 px-6 py-3 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Update Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TodoList