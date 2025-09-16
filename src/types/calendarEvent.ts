export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color?: string;
  userId: string;
  claimId?: string; // Reference to claim for color coding
}