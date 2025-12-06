
export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  completed: boolean;
  completedAt?: Date;
  alarmEnabled: boolean;
  alarmTime?: Date;
  priority: 'low' | 'medium' | 'high';
  userId: string;
  evidenceId?: string; // Reference to linked evidence item
}
