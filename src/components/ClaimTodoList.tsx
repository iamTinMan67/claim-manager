import { useState } from "react";
import { TodoItem } from "@/types/todo";
import { Evidence } from "@/types/evidence";
import { Claim } from "@/hooks/useClaims";
import { useClaimTodos, ClaimTodo } from "@/hooks/useClaimTodos";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Clock, Bell, Plus, Filter } from "lucide-react";
import { format } from "date-fns";
import { AddTodoModal } from "./AddTodoModal";
import { useTodos } from "@/hooks/useTodos";

interface Props {
  selectedClaimId?: string | null;
  claims?: Claim[];
  evidence?: Evidence[];
  showAddButton?: boolean;
  title?: string;
  maxHeight?: string;
}

export const ClaimTodoList = ({ 
  selectedClaimId, 
  claims = [], 
  evidence = [], 
  showAddButton = true, 
  title = "Tasks",
  maxHeight = "400px"
}: Props) => {
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [filterByActiveClaim, setFilterByActiveClaim] = useState(false);
  const { todos, addTodo, updateTodo, deleteTodo } = useTodos();
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

  // Get todos to display
  const displayTodos = filterByActiveClaim && selectedClaimId 
    ? getActiveClaimTodos() 
    : claimTodos.filter(todo => !todo.completed);

  const getClaimName = (claimId: string) => {
    const claim = claims.find(c => c.case_number === claimId);
    return claim ? claim.title : 'Unknown Claim';
  };

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
                <Button
                  onClick={() => setShowAddTodo(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" style={{ maxHeight, overflowY: 'auto' }}>
            {displayTodos.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No outstanding tasks
              </p>
            ) : (
              displayTodos.map((todo: ClaimTodo) => (
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
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {showAddTodo && (
        <AddTodoModal
          onClose={() => setShowAddTodo(false)}
          onAdd={handleAddTodo}
        />
      )}
    </>
  );
};