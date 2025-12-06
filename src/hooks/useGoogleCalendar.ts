
import { useState } from 'react';
import { googleCalendarService, CalendarEvent } from '@/services/googleCalendar';
import { toast } from 'sonner';

export const useGoogleCalendar = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const initializeCalendar = async () => {
    try {
      setIsInitializing(true);
      await googleCalendarService.initialize();
      setIsSignedIn(googleCalendarService.isUserSignedIn());
      
      if (!googleCalendarService.isUserSignedIn()) {
        toast.info("Please sign in to Google Calendar to create reminders");
      }
    } catch (error) {
      console.error('Failed to initialize Google Calendar:', error);
      toast.error('Failed to initialize Google Calendar. Using local storage instead.');
    } finally {
      setIsInitializing(false);
    }
  };

  const signInToCalendar = async () => {
    try {
      await googleCalendarService.signIn();
      setIsSignedIn(true);
      toast.success('Successfully signed in to Google Calendar');
    } catch (error) {
      console.error('Failed to sign in to Google Calendar:', error);
      toast.error('Failed to sign in to Google Calendar');
    }
  };

  const createCalendarEvent = async (event: CalendarEvent) => {
    try {
      if (!isSignedIn) {
        await signInToCalendar();
      }
      
      const result = await googleCalendarService.createEvent(event);
      toast.success('Calendar reminder created successfully');
      return result;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      toast.error('Failed to create calendar reminder');
      throw error;
    }
  };

  return {
    isInitializing,
    isSignedIn,
    initializeCalendar,
    signInToCalendar,
    createCalendarEvent
  };
};
