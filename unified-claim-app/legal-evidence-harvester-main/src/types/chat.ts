export interface ChatMessage {
  id: string;
  claim_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    email: string;
    full_name: string;
  };
}

export interface ChatParticipant {
  id: string;
  email: string;
  full_name: string;
  online: boolean;
  last_seen?: string;
}