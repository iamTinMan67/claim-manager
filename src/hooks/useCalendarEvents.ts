import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarEvent } from '@/types/calendarEvent';
import { toast } from 'sonner';

interface DbCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color?: string;
  claim_id?: string;
}

export const useCalendarEvents = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchEvents = async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;

      const formattedEvents: CalendarEvent[] = (data || []).map((event: DbCalendarEvent) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: new Date(event.start_time),
        endTime: new Date(event.end_time),
        allDay: event.all_day,
        color: event.color,
        userId: event.user_id,
        claimId: event.claim_id,
      }));

      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async (eventData: Omit<CalendarEvent, 'id' | 'userId'>) => {
    if (!user) {
      toast.error('You must be logged in to add events');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{
          user_id: user.id,
          title: eventData.title,
          description: eventData.description,
          start_time: eventData.startTime.toISOString(),
          end_time: eventData.endTime.toISOString(),
          all_day: eventData.allDay,
          color: eventData.color,
          claim_id: eventData.claimId,
        }])
        .select()
        .single();

      if (error) throw error;

      const newEvent: CalendarEvent = {
        id: data.id,
        title: data.title,
        description: data.description,
        startTime: new Date(data.start_time),
        endTime: new Date(data.end_time),
        allDay: data.all_day,
        color: data.color,
        userId: data.user_id,
        claimId: data.claim_id,
      };

      setEvents(prev => [...prev, newEvent]);
      toast.success('Calendar event added successfully');
    } catch (error) {
      console.error('Error adding calendar event:', error);
      toast.error('Failed to add calendar event');
    }
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    try {
      const updateData: any = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.startTime !== undefined) updateData.start_time = updates.startTime.toISOString();
      if (updates.endTime !== undefined) updateData.end_time = updates.endTime.toISOString();
      if (updates.allDay !== undefined) updateData.all_day = updates.allDay;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.claimId !== undefined) updateData.claim_id = updates.claimId;

      const { error } = await supabase
        .from('calendar_events')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setEvents(prev => prev.map(event => 
        event.id === id ? { ...event, ...updates } : event
      ));
      toast.success('Calendar event updated successfully');
    } catch (error) {
      console.error('Error updating calendar event:', error);
      toast.error('Failed to update calendar event');
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEvents(prev => prev.filter(event => event.id !== id));
      toast.success('Calendar event deleted successfully');
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      toast.error('Failed to delete calendar event');
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user]);

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    refetch: fetchEvents
  };
};