
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TodoItem } from '@/types/todo';
import { toast } from 'sonner';

// Database todo structure that includes evidence_id
interface DbTodo {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  alarm_enabled: boolean;
  alarm_time: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
  evidence_id: string | null;
}

export const useTodos = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTodos();
    } else {
      setTodos([]);
      setLoading(false);
    }
  }, [user]);

  const fetchTodos = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const formattedTodos: TodoItem[] = (data as DbTodo[] || []).map(todo => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        dueDate: new Date(todo.due_date),
        completed: todo.completed,
        completedAt: todo.completed_at ? new Date(todo.completed_at) : undefined,
        alarmEnabled: todo.alarm_enabled,
        alarmTime: todo.alarm_time ? new Date(todo.alarm_time) : undefined,
        priority: todo.priority as 'low' | 'medium' | 'high',
        userId: todo.user_id,
        evidenceId: todo.evidence_id
      }));

      setTodos(formattedTodos);
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast.error('Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (todoData: Omit<TodoItem, 'id' | 'userId'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('todos')
        .insert({
          title: todoData.title,
          description: todoData.description,
          due_date: todoData.dueDate.toISOString(),
          completed: todoData.completed,
          completed_at: todoData.completedAt?.toISOString(),
          alarm_enabled: todoData.alarmEnabled,
          alarm_time: todoData.alarmTime?.toISOString(),
          priority: todoData.priority,
          user_id: user.id,
          evidence_id: todoData.evidenceId
        })
        .select()
        .single();

      if (error) throw error;

      const newTodo: TodoItem = {
        id: (data as DbTodo).id,
        title: (data as DbTodo).title,
        description: (data as DbTodo).description,
        dueDate: new Date((data as DbTodo).due_date),
        completed: (data as DbTodo).completed,
        completedAt: (data as DbTodo).completed_at ? new Date((data as DbTodo).completed_at) : undefined,
        alarmEnabled: (data as DbTodo).alarm_enabled,
        alarmTime: (data as DbTodo).alarm_time ? new Date((data as DbTodo).alarm_time) : undefined,
        priority: (data as DbTodo).priority as 'low' | 'medium' | 'high',
        userId: (data as DbTodo).user_id,
        evidenceId: (data as DbTodo).evidence_id
      };

      setTodos([...todos, newTodo]);
      toast.success('Task added successfully');
    } catch (error) {
      console.error('Error adding todo:', error);
      toast.error('Failed to add task');
    }
  };

  const updateTodo = async (id: string, updates: Partial<TodoItem>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('todos')
        .update({
          title: updates.title,
          description: updates.description,
          due_date: updates.dueDate?.toISOString(),
          completed: updates.completed,
          completed_at: updates.completedAt?.toISOString(),
          alarm_enabled: updates.alarmEnabled,
          alarm_time: updates.alarmTime?.toISOString(),
          priority: updates.priority,
          evidence_id: updates.evidenceId
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTodos(todos.map(todo => 
        todo.id === id ? { ...todo, ...updates } : todo
      ));
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Failed to update task');
    }
  };

  const deleteTodo = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTodos(todos.filter(todo => todo.id !== id));
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast.error('Failed to delete task');
    }
  };

  return {
    todos,
    loading,
    addTodo,
    updateTodo,
    deleteTodo,
    refetch: fetchTodos
  };
};
