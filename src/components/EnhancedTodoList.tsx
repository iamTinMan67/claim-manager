import { useState } from "react";
import { TodoItem } from "@/types/todo";
import { Evidence } from "@/types/evidence";
import { Claim } from "@/hooks/useClaims";
import { useClaimTodos, ClaimTodo } from "@/hooks/useClaimTodos";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Clock, Bell, Plus, Filter, Calendar } from "lucide-react";
import { format, isToday } from "date-fns";
import { AddTodoModal } from "./AddTodoModal";
import { AddCalendarEventModal } from "./AddCalendarEventModal";
import { useTodos } from "@/hooks/useTodos";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useEvidence } from "@/hooks/useEvidence";
import { Input } from "./ui/input";
import { useToast } from "./ui/use-toast";

interface Props {
  selectedClaimId?: string | null;
  claims?: Claim[];
  evidence?: Evidence[];
  showAddButton?: boolean;
  title?: string;
  maxHeight?: string;
}

export const EnhancedTodoList = ({ 
  selectedClaimId, 
  claims = [], 
  evidence = [], 
  showAddButton = true, 
  title = "Tasks",
  maxHeight = "600px"
}: Props) => {
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [filterByActiveClaim, setFilterByActiveClaim] = useState(false);
  const [editingCompletionDate, setEditingCompletionDate] = useState<string | null>(null);
  const { todos, addTodo, updateTodo, deleteTodo } = useTodos();
  const { addEvent } = useCalendarEvents();
  const { updateEvidence } = useEvidence();
  const { toast } = useToast();
  const { claimTodos, getActiveClaimTodos, getTodoColor, getTodoBadgeColor } = useClaimTodos(
    todos, evidence, claims, selectedClaimId
  );

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

  const handleCompletionDateUpdate = async (todoId: string, newDate: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo || !newDate) return;

    try {
      // Update the todo completion date
      const completionDate = new Date(newDate);
      await updateTodo(todoId, { 
        completedAt: completionDate,
        completed: true 
      });

      // If this todo is linked to evidence, update the evidence date_submitted
      if (todo.evidenceId) {
        const linkedEvidence = evidence.find(e => e.id === todo.evidenceId);
        if (linkedEvidence) {
          await updateEvidence(todo.evidenceId, {
            date_submitted: newDate
          });
          
          toast({
            title: "Updated Evidence Date",
            description: "Evidence submission date has been updated to match completion date."
          });
        }
      }

      setEditingCompletionDate(null);
      toast({
        title: "Task Completed",
        description: "Task marked as completed and dates updated."
      });
    } catch (error) {
      console.error('Error updating completion date:', error);
      toast({
        title: "Error",
        description: "Failed to update completion date.",
        variant: "destructive"
      });
    }
  };

  // Separate todos into daily (due today) and general
  const allDisplayTodos = filterByActiveClaim && selectedClaimId 
    ? getActiveClaimTodos() 
    : claimTodos;

  const dailyTodos = allDisplayTodos.filter(todo => 
    !todo.completed && isToday(todo.dueDate)
  );

  const generalTodos = allDisplayTodos.filter(todo => 
    !todo.completed && !isToday(todo.dueDate)
  );

  const getClaimName = (claimId: string) => {
    const claim = claims.find(c => c.case_number === claimId);
    return claim ? claim.title : 'Unknown Claim';
  };

  const renderTodoItem = (todo: ClaimTodo) => (
    <div
      key={todo.id}
      className={`p-3 border rounded-lg transition-all ${
        todo.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
      } ${getTodoColor(todo, todo.claimIds.includes(selectedClaimId || ''))}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggleTodo(todo.id)}
              className="rounded"
            />
            <h4 className={`font-medium ${todo.completed ? 'line-through text-gray-500' : ''}`}>
              {todo.title}
            </h4>
            <Badge 
              variant={todo.priority === 'high' ? 'destructive' : todo.priority === 'medium' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {todo.priority}
            </Badge>
          </div>
          
          {todo.description && (
            <p className={`text-sm mt-1 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
              {todo.description}
            </p>
          )}
          
          {/* Show claim associations */}
          {todo.claimIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {todo.claimIds.map(claimId => (
                <Badge
                  key={claimId}
                  variant="outline"
                  className={`text-xs ${
                    selectedClaimId === claimId ? getTodoBadgeColor(todo) : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {getClaimName(claimId)}
                </Badge>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            {format(todo.dueDate, 'PPP')}
            {todo.alarmEnabled && todo.alarmTime && (
              <>
                <Bell className="h-3 w-3" />
                <span>Alarm: {format(todo.alarmTime, 'PPP HH:mm')}</span>
              </>
            )}
          </div>

          {/* Completion date editing */}
          {todo.completed && todo.completedAt && (
            <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
              <Calendar className="h-3 w-3" />
              <span>Completed: {format(todo.completedAt, 'PPP')}</span>
            </div>
          )}

          {!todo.completed && (
            <div className="flex items-center gap-2 mt-2">
              {editingCompletionDate === todo.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="w-32 h-6 text-xs"
                    onChange={(e) => handleCompletionDateUpdate(todo.id, e.target.value)}
                    onBlur={() => setEditingCompletionDate(null)}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingCompletionDate(null)}
                    className="h-6 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingCompletionDate(todo.id)}
                  className="h-6 px-2 text-xs"
                >
                  Set Completion Date
                </Button>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteTodo(todo.id)}
          className="text-red-500 hover:text-red-700 ml-2"
        >
          ×
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <div className="flex items-center gap-2">
              {selectedClaimId && (
                <Button
                  variant={filterByActiveClaim ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterByActiveClaim(!filterByActiveClaim)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {filterByActiveClaim ? 'Show All' : 'Active Only'}
                </Button>
              )}
              {showAddButton && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowAddTodo(true)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                  <Button
                    onClick={() => setShowAddEvent(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ maxHeight, overflowY: 'auto' }}>
          {/* Daily To-Do Section */}
          <div className="mb-6">
            <h3 className="text-md font-semibold mb-3 text-orange-600 border-b border-orange-200 pb-1">
              Daily Tasks ({format(new Date(), 'PPP')})
            </h3>
            <div className="space-y-3">
              {dailyTodos.length === 0 ? (
                <p className="text-gray-500 text-center py-2 text-sm">
                  No tasks due today
                </p>
              ) : (
                dailyTodos.map(renderTodoItem)
              )}
            </div>
          </div>

          {/* General To-Do Section */}
          <div>
            <h3 className="text-md font-semibold mb-3 text-blue-600 border-b border-blue-200 pb-1">
              General Tasks
            </h3>
            <div className="space-y-3">
              {generalTodos.length === 0 ? (
                <p className="text-gray-500 text-center py-2 text-sm">
                  No other outstanding tasks
                </p>
              ) : (
                generalTodos.map(renderTodoItem)
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showAddTodo && (
        <AddTodoModal
          onClose={() => setShowAddTodo(false)}
          onAdd={handleAddTodo}
        />
      )}

      {showAddEvent && (
        <AddCalendarEventModal
          isOpen={showAddEvent}
          onClose={() => setShowAddEvent(false)}
          onAdd={addEvent}
          claims={claims}
        />
      )}
    </>
  );
};