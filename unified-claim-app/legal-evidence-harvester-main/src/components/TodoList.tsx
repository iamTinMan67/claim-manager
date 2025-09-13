
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Calendar } from "./ui/calendar";
import { toast } from "sonner";
import { Trash2, Calendar as CalendarIcon, LogIn } from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  followUpDate?: Date;
  calendarEventId?: string;
}

export const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [date, setDate] = useState<Date>();
  
  const {
    isInitializing,
    isSignedIn,
    initializeCalendar,
    signInToCalendar,
    createCalendarEvent
  } = useGoogleCalendar();

  useEffect(() => {
    initializeCalendar();
    
    // Load todos from localStorage
    const savedTodos = localStorage.getItem('case-todos');
    if (savedTodos) {
      const parsedTodos = JSON.parse(savedTodos).map((todo: any) => ({
        ...todo,
        followUpDate: todo.followUpDate ? new Date(todo.followUpDate) : undefined
      }));
      setTodos(parsedTodos);
    }
  }, []);

  useEffect(() => {
    // Save todos to localStorage whenever todos change
    const todosToSave = todos.map(todo => ({
      ...todo,
      followUpDate: todo.followUpDate?.toISOString()
    }));
    localStorage.setItem('case-todos', JSON.stringify(todosToSave));
  }, [todos]);

  const addTodo = async () => {
    if (!newTodo.trim()) {
      toast.error("Please enter a task");
      return;
    }

    if (!date) {
      toast.error("Please select a follow-up date");
      return;
    }

    const newTodoItem: Todo = {
      id: Date.now(),
      text: newTodo,
      completed: false,
      followUpDate: date
    };

    try {
      if (isSignedIn) {
        // Create Google Calendar event
        const event = {
          summary: `Case Task: ${newTodo}`,
          start: {
            dateTime: date.toISOString(),
          },
          end: {
            dateTime: new Date(date.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
          },
          description: `Case management task: ${newTodo}`
        };

        const calendarResult = await createCalendarEvent(event);
        newTodoItem.calendarEventId = calendarResult.id;
      } else {
        toast.info("Task saved locally. Sign in to Google Calendar to create reminders.");
      }

      setTodos([...todos, newTodoItem]);
      setNewTodo("");
      setDate(undefined);
      
    } catch (error) {
      // Still add the todo locally even if calendar creation fails
      setTodos([...todos, newTodoItem]);
      setNewTodo("");
      setDate(undefined);
      console.error('Calendar integration failed:', error);
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id));
    toast.success("Task removed successfully");
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Case Tasks</h2>
        {!isSignedIn && !isInitializing && (
          <Button
            onClick={signInToCalendar}
            variant="outline"
            size="sm"
            className="text-blue-600"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Sign in to Google Calendar
          </Button>
        )}
      </div>
      
      <div className="flex gap-2 mb-4">
        <Input
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new task..."
          onKeyPress={(e) => e.key === "Enter" && addTodo()}
          className="flex-1"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={date ? "w-[240px]" : "w-[240px] text-muted-foreground"}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : "Pick a follow-up date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button onClick={addTodo} disabled={isInitializing}>
          Add Task
        </Button>
      </div>
      
      <div className="space-y-2">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg border"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                checked={todo.completed}
                onCheckedChange={() => toggleTodo(todo.id)}
              />
              <div className="flex flex-col">
                <span
                  className={`${
                    todo.completed ? "line-through text-gray-500" : "text-gray-900"
                  }`}
                >
                  {todo.text}
                </span>
                {todo.followUpDate && (
                  <span className="text-sm text-gray-500">
                    Follow-up: {format(todo.followUpDate, "PPP")}
                    {todo.calendarEventId && " • Calendar reminder created"}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteTodo(todo.id)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
