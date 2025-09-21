
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Calendar } from "./ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TodoItem } from "@/types/todo";

interface Props {
  onClose: () => void;
  onAdd: (todo: Omit<TodoItem, "id" | "userId">) => void;
  defaultDate?: Date;
}

export const AddTodoModal = ({ onClose, onAdd, defaultDate }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(defaultDate || new Date());
  const [time, setTime] = useState("09:00");
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmDate, setAlarmDate] = useState<Date | undefined>(defaultDate || new Date());
  const [alarmTime, setAlarmTime] = useState("08:30");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    
    // Validate required fields
    const errors: {[key: string]: string} = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!date) {
      errors.date = 'Date is required';
    }
    
    // If there are validation errors, set them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Combine date and time
    const [hours, minutes] = time.split(':').map(Number);
    const dueDate = new Date(date);
    dueDate.setHours(hours, minutes, 0, 0);

    // Combine alarm date and time if alarm is enabled
    let alarmDateTime: Date | undefined;
    if (alarmEnabled && alarmDate) {
      const [alarmHours, alarmMinutes] = alarmTime.split(':').map(Number);
      alarmDateTime = new Date(alarmDate);
      alarmDateTime.setHours(alarmHours, alarmMinutes, 0, 0);
    }

    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      completed: false,
      alarmEnabled,
      alarmTime: alarmDateTime,
      priority
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Add New Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearError('title');
                }}
                placeholder="Enter task title"
                className={formErrors.title ? 'border-red-500 focus:border-red-500' : ''}
                required
              />
              {formErrors.title && (
                <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task description (optional)"
                rows={3}
              />
            </div>

            <div>
              <Label>Due Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground",
                      formErrors.date && "border-red-500"
                    )}
                    onClick={() => clearError('date')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {formErrors.date && (
                <p className="text-red-500 text-sm mt-1">{formErrors.date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="time">Due Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="alarm">Enable Alarm</Label>
              <Switch
                id="alarm"
                checked={alarmEnabled}
                onCheckedChange={setAlarmEnabled}
              />
            </div>

            {alarmEnabled && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                <div>
                  <Label>Alarm Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !alarmDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {alarmDate ? format(alarmDate, "PPP") : "Pick alarm date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={alarmDate}
                        onSelect={setAlarmDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="alarmTime">Alarm Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <Input
                      id="alarmTime"
                      type="time"
                      value={alarmTime}
                      onChange={(e) => setAlarmTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Add Task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
