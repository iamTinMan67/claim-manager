import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChevronLeft, ChevronRight, Plus, Clock, Bell, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";
import { TodoItem } from "@/types/todo";
import { CalendarEvent } from "@/types/calendarEvent";
import { Evidence } from "@/types/evidence";
import { Claim } from "@/hooks/useClaims";
import { AddTodoModal } from "./AddTodoModal";
import { AddCalendarEventModal } from "./AddCalendarEventModal";
import { AlarmNotification } from "./AlarmNotification";
import { useTodos } from "@/hooks/useTodos";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useClaimTodos } from "@/hooks/useClaimTodos";
import { toast } from "sonner";
import { EnhancedTodoList } from "./EnhancedTodoList";

interface Props {
  selectedClaimId?: string | null;
  claims?: Claim[];
  evidence?: Evidence[];
}

export const InHouseCalendar = ({ selectedClaimId, claims = [], evidence = [] }: Props) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<TodoItem | null>(null);
  const [filterByActiveClaim, setFilterByActiveClaim] = useState(false);
  
  const { user } = useAuth();
  const { todos, loading, addTodo, updateTodo, deleteTodo } = useTodos();
  const { events, loading: eventsLoading, addEvent } = useCalendarEvents();
  const { claimTodos, getActiveClaimTodos, getTodoColor, getTodoBadgeColor } = useClaimTodos(
    todos, evidence, claims, selectedClaimId
  );

  // Check for due alarms
  useEffect(() => {
    const checkAlarms = () => {
      if (!user) return;
      
      const now = new Date();
      const todosToCheck = filterByActiveClaim ? getActiveClaimTodos() : claimTodos;
      const dueAlarms = todosToCheck.filter(todo => 
        !todo.completed && 
        todo.alarmEnabled && 
        todo.alarmTime && 
        todo.alarmTime <= now &&
        !activeAlarm // Don't show multiple alarms at once
      );

      if (dueAlarms.length > 0 && !activeAlarm) {
        setActiveAlarm(dueAlarms[0]);
        
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Task Alarm: ${dueAlarms[0].title}`, {
            body: dueAlarms[0].description || 'You have a task alarm.',
            icon: '/favicon.ico'
          });
        }
      }
    };

    const interval = setInterval(checkAlarms, 30000); // Check every 30 seconds
    checkAlarms(); // Check immediately
    
    return () => clearInterval(interval);
  }, [claimTodos, user, activeAlarm, filterByActiveClaim, getActiveClaimTodos]);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleAddTodo = (todoData: Omit<TodoItem, "id" | "userId">) => {
    addTodo(todoData);
    setShowAddTodo(false);
  };

  const handleToggleTodo = (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      updateTodo(id, { 
        completed: !todo.completed,
        completedAt: !todo.completed ? new Date() : undefined
      });
    }
  };

  const handleCompleteAlarm = () => {
    if (activeAlarm) {
      updateTodo(activeAlarm.id, { 
        completed: true,
        completedAt: new Date()
      });
      setActiveAlarm(null);
    }
  };

  const handleSnoozeAlarm = (minutes: number) => {
    if (activeAlarm) {
      const newAlarmTime = new Date();
      newAlarmTime.setMinutes(newAlarmTime.getMinutes() + minutes);
      
      updateTodo(activeAlarm.id, { 
        alarmTime: newAlarmTime
      });
      setActiveAlarm(null);
      toast.success(`Task snoozed for ${minutes} minutes`);
    }
  };

  const getTodosForDate = (date: Date) => {
    const todosToUse = filterByActiveClaim && selectedClaimId ? getActiveClaimTodos(date) : claimTodos.filter(todo => isSameDay(todo.dueDate, date));
    return todosToUse;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (event.allDay) {
        return isSameDay(event.startTime, date);
      }
      // For non-all-day events, check if the date falls within the event timespan
      return isSameDay(event.startTime, date);
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const selectedDateTodos = selectedDate ? getTodosForDate(selectedDate) : [];

  if (!user) {
    return (
      <div className="card-enhanced rounded-lg shadow text-center py-8">
        <div className="card-smudge p-6">
          <p className="text-white">Please log in to view your calendar.</p>
        </div>
      </div>
    );
  }

  if (loading || eventsLoading) {
    return (
      <div className="card-enhanced rounded-lg shadow text-center py-8">
        <div className="card-smudge p-6">
          <p className="text-white">Loading your tasks and events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2">
          <div className="card-enhanced rounded-lg shadow">
            <div className="card-smudge p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {format(currentDate, 'MMMM yyyy')}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="btn-gold px-3 py-1 rounded"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="btn-gold px-3 py-1 rounded"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {selectedClaimId && (
                    <button
                      onClick={() => setFilterByActiveClaim(!filterByActiveClaim)}
                      className={`px-3 py-1 rounded text-sm ${
                        filterByActiveClaim 
                          ? 'bg-yellow-400/20 text-gold border border-yellow-400' 
                          : 'btn-gold'
                      }`}
                    >
                      <Filter className="h-4 w-4 mr-2 inline" />
                      {filterByActiveClaim ? 'Show All' : 'Filter Active'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddTodo(true)}
                    className="btn-gold px-3 py-1 rounded ml-2"
                  >
                    <Plus className="h-4 w-4 mr-2 inline" />
                    Add Task
                  </button>
                  <button
                    onClick={() => setShowAddEvent(true)}
                    className="bg-yellow-400/20 text-gold border border-yellow-400 px-3 py-1 rounded ml-2"
                  >
                    <Clock className="h-4 w-4 mr-2 inline" />
                    Add Event
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentDate}
                onMonthChange={setCurrentDate}
                className="w-full"
                components={{
                  Day: ({ date, ...props }) => {
                    const dayTodos = getTodosForDate(date);
                    const dayEvents = getEventsForDate(date);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const isCurrentMonth = isSameMonth(date, currentDate);
                    
                    // Determine if this day has active claim todos
                    const hasActiveClaimTodos = selectedClaimId && dayTodos.some(todo => 
                      'claimIds' in todo && todo.claimIds.includes(selectedClaimId)
                    );
                    
                    return (
                      <div
                        className={`relative p-2 text-center cursor-pointer rounded-md ${
                          isSelected ? 'bg-yellow-400/30 text-white' : ''
                        } ${isCurrentMonth ? 'text-white' : 'text-gray-400'}`}
                        onClick={() => setSelectedDate(date)}
                      >
                        <span className="text-sm">{format(date, 'd')}</span>
                        <div className="flex justify-center mt-1 gap-1">
                          {dayTodos.length > 0 && (
                            <span 
                              className={`text-xs px-1 py-0 rounded ${
                                dayTodos.some(t => !t.completed) 
                                  ? 'bg-red-500 text-white' 
                                  : 'bg-green-500 text-white'
                              } ${
                                hasActiveClaimTodos && selectedClaimId ? getTodoBadgeColor(dayTodos.find(t => 'claimIds' in t && t.claimIds.includes(selectedClaimId))!) : ''
                              }`}
                            >
                              {dayTodos.length}
                            </span>
                          )}
                          {dayEvents.length > 0 && (
                            <span 
                              className="text-xs px-1 py-0 rounded bg-yellow-400 text-white"
                            >
                              {dayEvents.length}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Enhanced Tasks Panel */}
        <div className="lg:col-span-1">
          <div className="card-enhanced rounded-lg shadow">
            <div className="card-smudge p-4">
              <h3 className="text-lg font-bold text-white">
                Tasks for {selectedDate ? format(selectedDate, 'PPP') : 'Today'}
              </h3>
            </div>
            <div className="p-4">
              <EnhancedTodoList 
                selectedClaimId={selectedClaimId}
                claims={claims || []}
                evidence={evidence || []}
                title=""
                maxHeight="300px"
              />
            </div>
          </div>
          
          {/* Calendar Events for Selected Date */}
          <div className="card-enhanced rounded-lg shadow mt-4">
            <div className="card-smudge p-4">
              <h3 className="text-lg font-bold text-white">
                Events for {selectedDate ? format(selectedDate, 'PPP') : 'Today'}
              </h3>
            </div>
            <div className="p-4" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <div className="space-y-2">
                {getEventsForDate(selectedDate || new Date()).map((event) => (
                  <div 
                    key={event.id} 
                    className={`p-2 rounded border-l-4 ${
                      event.color ? `border-${event.color}-500` : 'border-yellow-400'
                    } bg-yellow-400/10`}
                  >
                    <div className="font-medium text-white">{event.title}</div>
                    {event.description && (
                      <div className="text-sm text-gray-300">{event.description}</div>
                    )}
                    <div className="text-xs text-gray-400">
                      {event.allDay 
                        ? 'All day' 
                        : `${format(event.startTime, 'HH:mm')} - ${format(event.endTime, 'HH:mm')}`
                      }
                    </div>
                  </div>
                ))}
                {getEventsForDate(selectedDate || new Date()).length === 0 && (
                  <div className="text-gray-400 text-sm text-center py-4">No events for this date</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddTodo && (
        <AddTodoModal
          onClose={() => setShowAddTodo(false)}
          onAdd={handleAddTodo}
          defaultDate={selectedDate}
        />
      )}

      {showAddEvent && (
        <AddCalendarEventModal
          isOpen={showAddEvent}
          onClose={() => setShowAddEvent(false)}
          onAdd={addEvent}
          selectedDate={selectedDate}
          claims={claims}
        />
      )}

      {activeAlarm && (
        <AlarmNotification
          todo={activeAlarm}
          onComplete={handleCompleteAlarm}
          onSnooze={handleSnoozeAlarm}
          onDismiss={() => setActiveAlarm(null)}
        />
      )}
    </div>
  );
};