import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CalendarEvent } from '@/types/calendarEvent';
import { Claim } from '@/hooks/useClaims';
import { getClaimColor } from '@/utils/claimColors';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (eventData: Omit<CalendarEvent, 'id' | 'userId'>) => void;
  selectedDate?: Date;
  claims?: Claim[];
}

export const AddCalendarEventModal = ({ isOpen, onClose, onAdd, selectedDate, claims }: Props) => {
  const [title, setTitle] = useState('Test Modal Event');
  const [description, setDescription] = useState('Test modal event description');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');
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

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime('');
    setEndTime('');
    setAllDay(false);
    setSelectedClaimId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    
    // Validate required fields
    const errors: {[key: string]: string} = {};
    
    if (!title.trim()) {
      errors.title = 'Event Title is required';
    }
    
    // If there are validation errors, set them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    let eventStartTime: Date;
    let eventEndTime: Date;

    if (allDay) {
      eventStartTime = selectedDate ? new Date(selectedDate) : new Date();
      eventStartTime.setHours(0, 0, 0, 0);
      eventEndTime = new Date(eventStartTime);
      eventEndTime.setHours(23, 59, 59, 999);
    } else {
      eventStartTime = startTime ? new Date(startTime) : new Date();
      eventEndTime = endTime ? new Date(endTime) : new Date(eventStartTime.getTime() + 60 * 60 * 1000); // 1 hour later
    }

    const color = selectedClaimId ? getClaimColor(selectedClaimId).border.replace('border-', '') : undefined;

    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      startTime: eventStartTime,
      endTime: eventEndTime,
      allDay,
      color,
      claimId: selectedClaimId || undefined,
    });

    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Format date for datetime-local input
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Set default times when opening modal
  const getDefaultStartTime = () => {
    const date = selectedDate || new Date();
    const now = new Date();
    if (selectedDate) {
      date.setHours(now.getHours(), now.getMinutes());
    }
    return formatDateTimeLocal(date);
  };

  const getDefaultEndTime = () => {
    const date = selectedDate || new Date();
    const now = new Date();
    if (selectedDate) {
      date.setHours(now.getHours() + 1, now.getMinutes());
    } else {
      date.setTime(date.getTime() + 60 * 60 * 1000); // 1 hour later
    }
    return formatDateTimeLocal(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Calendar Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearError('title');
              }}
              placeholder="Enter event title"
              className={formErrors.title ? 'border-red-500 focus:border-red-500' : ''}
              required
            />
            {formErrors.title && (
              <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter event description"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="all-day"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
            <Label htmlFor="all-day">All day event</Label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTime || getDefaultStartTime()}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="datetime-local"
                  value={endTime || getDefaultEndTime()}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {claims && claims.length > 0 && (
            <div>
              <Label>Link to Claim (Optional)</Label>
              <Select value={selectedClaimId} onValueChange={setSelectedClaimId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a claim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No claim</SelectItem>
                  {claims.map((claim) => (
                    <SelectItem key={claim.case_number} value={claim.case_number}>
                      {claim.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Add Event</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};