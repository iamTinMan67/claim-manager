
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Clock, CheckCircle, AlarmClock } from 'lucide-react';
import { TodoItem } from '@/types/todo';

interface Props {
  todo: TodoItem;
  onComplete: () => void;
  onSnooze: (minutes: number) => void;
  onDismiss: () => void;
}

export const AlarmNotification = ({ todo, onComplete, onSnooze, onDismiss }: Props) => {
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Clock className="h-5 w-5" />
            Task Alarm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{todo.title}</h3>
            {todo.description && (
              <p className="text-gray-600 mt-1">{todo.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Due: {todo.dueDate.toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={onComplete}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Mark Complete
            </Button>

            <div className="flex items-center gap-2">
              <select 
                value={snoozeMinutes}
                onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
              <Button 
                onClick={() => onSnooze(snoozeMinutes)}
                variant="outline"
                className="flex-1 flex items-center gap-2"
              >
                <AlarmClock className="h-4 w-4" />
                Snooze
              </Button>
            </div>

            <Button 
              onClick={onDismiss}
              variant="ghost"
              className="text-gray-500"
            >
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
