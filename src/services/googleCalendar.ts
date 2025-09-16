
declare global {
  interface Window {
    gapi: any;
  }
}

export interface CalendarEvent {
  summary: string;
  start: {
    dateTime: string;
  };
  end: {
    dateTime: string;
  };
  description?: string;
}

class GoogleCalendarService {
  private isInitialized = false;
  private isSignedIn = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Load Google API script
      if (!window.gapi) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          this.loadGapi().then(resolve).catch(reject);
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        this.loadGapi().then(resolve).catch(reject);
      }
    });
  }

  private async loadGapi(): Promise<void> {
    await new Promise<void>((resolve) => {
      window.gapi.load('auth2:client', resolve);
    });

    await window.gapi.client.init({
      apiKey: 'YOUR_API_KEY', // Replace with your Google API key
      clientId: 'YOUR_CLIENT_ID', // Replace with your Google Client ID
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
      scope: 'https://www.googleapis.com/auth/calendar.events'
    });

    this.isInitialized = true;
    this.isSignedIn = window.gapi.auth2.getAuthInstance().isSignedIn.get();
  }

  async signIn(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isSignedIn) {
      await window.gapi.auth2.getAuthInstance().signIn();
      this.isSignedIn = true;
    }
  }

  async createEvent(event: CalendarEvent): Promise<any> {
    if (!this.isSignedIn) {
      await this.signIn();
    }

    const request = window.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    return request.execute();
  }

  isUserSignedIn(): boolean {
    return this.isSignedIn && this.isInitialized;
  }
}

export const googleCalendarService = new GoogleCalendarService();
