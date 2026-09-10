export type CommunicationType = 'Call' | 'Mail' | 'Text' | 'Email' | 'Visit';
export type CommunicationDirection = 'inbound' | 'outbound';

export interface CommunicationLog {
  id: string;
  claim_id: string;
  date: string;
  name: string;
  company: string | null;
  notes: string | null;
  type: CommunicationType;
  direction: CommunicationDirection;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export const COMMUNICATION_TYPES: CommunicationType[] = [
  'Call',
  'Mail',
  'Text',
  'Email',
  'Visit',
];

export const formatDirection = (direction: CommunicationDirection): string =>
  direction === 'inbound' ? 'Inbound' : 'Outbound';
