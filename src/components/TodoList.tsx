import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Todo } from '@/types/database'
import { Plus, Check, Clock, AlertCircle, Trash2, User, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

interface TodoWithUser extends Todo {
  profiles?: {
    email: string
  }
  claims?: {
    title: string
    status: string
  }
}

interface TodoListProps {
  selectedClaim: string | null
  claimColor?: string
}

const TodoList = ({ selectedClaim, claimColor = '#3B82F6' }: TodoListProps) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as const,
    alarm_enabled: false,
    alarm_time: '',
    case_number: selectedClaim || ''
  })

  const queryClient = useQueryClient()

  const { data: todos, isLoading } = useQuery({
    queryKey: ['todos', selectedClaim],
    queryFn: async () => {
      let query = supabase
        .from('todos')
        .select(`
          *,
          profiles(email),
          claims(title, status)
        `)
      
      if (selectedClaim) {
        query = query.eq('case_number', selectedClaim)
      }
      
      const { data, error } = await query
        .order('case_number', { ascending: true, nullsLast: true })
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return data as TodoWithUser[]
    }
  })

  const { data: claims } = useQuery({
    queryKey: ['claims-for-todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title, color')
        .eq('status', 'Active')
        .order('title')
      
      if (error) throw error
      return data
    }
  })

  const { data: todayTodos } = useQuery({
    queryKey: ['today-todos', selectedClaim],
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

  const addTodoMutation = useMutation({
    mutationFn: async (todo: typeof newTodo) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Ensure alarm_time is null if not enabled or empty
      const todoData = {
        ...todo,
        user_id: user.id,
        case_number: todo.case_number || null,
        alarm_time: todo.alarm_enabled && todo.alarm_time ? todo.alarm_time : null
      }
      const { data, error } = await supabase
        .from('todos')
        .insert([todoData])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      setShowAddForm(false)
      setNewTodo({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium',
        alarm_enabled: false,
        alarm_time: '',
        case_number: selectedClaim || ''
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
      {selectedClaim && (
        <div className="border-l-4 rounded-lg p-4" style={{ 
          borderLeftColor: claimColor,
          backgroundColor: `${claimColor}10`
        }}>
          <p style={{ color: claimColor }}>
            Showing todos for selected claim: <strong>{selectedClaim}</strong>
          </p>
        </div>
      )}
      
      {/* Daily Summary */}
      {todayTodos && todayTodos.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <div className="flex items-center space-x-2 mb-4">
            <CalendarIcon className="w-5 h-5" style={{ color: claimColor }} />
            <h3 className="text-lg font-semibold">Today's Tasks & Upcoming</h3>
          </div>
          <div className="space-y-3">
            {todayTodos.map((todo) => {
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
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{todo.title}</h4>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600">
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{todo.profiles?.email || 'Unknown user'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{format(dueDate, 'MMM d, h:mm a')}</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(todo.priority)}`}>
                          {todo.priority}
                        </span>
                        {isOverdue && <span className="text-red-600 font-medium text-xs">OVERDUE</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTodoMutation.mutate({ 
                        id: todo.id, 
                        completed: !todo.completed 
                      })}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
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
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">To-Do Lists</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="text-white px-4 py-2 rounded-lg hover:opacity-90 flex items-center space-x-2"
          style={{ backgroundColor: claimColor }}
        >
          <Plus className="w-4 h-4" />
          <span>Add Todo</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4" style={{ borderLeftColor: claimColor }}>
          <h3 className="text-lg font-semibold mb-4">Add New Todo</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={newTodo.title}
                onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Due Date *</label>
                <input
                  type="datetime-local"
                  value={newTodo.due_date}
                  onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={newTodo.priority}
                  onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="w-full border rounded-lg px-3 py-2"
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
                className="rounded"
              />
              <label htmlFor="alarm" className="text-sm">Enable alarm</label>
            </div>
            {newTodo.alarm_enabled && (
              <div>
                <label className="block text-sm font-medium mb-1">Alarm Time</label>
                <input
                  type="datetime-local"
                  value={newTodo.alarm_time}
                  onChange={(e) => setNewTodo({ ...newTodo, alarm_time: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Associated Claim</label>
              <select
                value={newTodo.case_number}
                onChange={(e) => setNewTodo({ ...newTodo, case_number: e.target.value })}
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
                disabled={addTodoMutation.isPending}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                {addTodoMutation.isPending ? 'Adding...' : 'Add Todo'}
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

      <div className="space-y-4">
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
                  <span className="text-sm text-gray-600">- {claimTodos[0].claims.title}</span>
                )}
                <span className="text-sm text-gray-500">({claimTodos.length} tasks)</span>
              </div>
              {claimTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`bg-white p-4 rounded-lg shadow border-l-4 ${
                    todo.completed ? 'opacity-75' : ''
                  }`}
                  style={{ borderLeftColor: claimColor }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <button
                        onClick={() => toggleTodoMutation.mutate({ 
                          id: todo.id, 
                          completed: !todo.completed 
                        })}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
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
                        {todo.completed && <Check className="w-3 h-3" />}
                      </button>
                      <div className="flex-1">
                        <h3 className={`font-medium ${todo.completed ? 'line-through text-gray-500' : ''}`}>
                          {todo.title}
                        </h3>
                        {todo.description && (
                          <p className={`text-sm mt-1 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                            {todo.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{format(new Date(todo.due_date), 'MMM d, yyyy h:mm a')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">By: {todo.profiles?.email || 'Unknown user'}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(todo.priority)}`}>
                            {todo.priority}
                          </span>
                          {todo.alarm_enabled && (
                            <div className="flex items-center space-x-1">
                              <AlertCircle className="w-4 h-4" style={{ color: claimColor }} />
                              <span className="text-gray-700">Alarm set</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTodoMutation.mutate(todo.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
    </div>
  )
}

export default TodoList