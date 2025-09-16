export interface PendingEvidence {
  id: string;
  claim_id: string;
  submitter_id: string;
  status: string; // Will be 'pending' | 'approved' | 'rejected' but database returns string
  submitted_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  
  // Evidence fields
  file_name?: string;
  file_url?: string;
  exhibit_id?: string;
  method?: string;
  url_link?: string;
  book_of_deeds_ref?: string;
  number_of_pages?: number;
  date_submitted?: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  submitter?: {
    id: string;
    email: string;
    full_name: string;
  };
}

export interface PendingEvidenceSubmission {
  claim_id: string;
  file_name?: string;
  file_url?: string;
  exhibit_id?: string;
  method?: string;
  url_link?: string;
  book_of_deeds_ref?: string;
  number_of_pages?: number;
  date_submitted?: string;
}