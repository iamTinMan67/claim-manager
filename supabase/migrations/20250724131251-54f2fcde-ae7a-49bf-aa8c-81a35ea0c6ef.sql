-- Fix the claims table to use case_number as primary key
ALTER TABLE claims DROP COLUMN id;
ALTER TABLE claims ADD CONSTRAINT claims_pkey PRIMARY KEY (case_number);

-- Now recreate the junction tables
CREATE TABLE claim_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  shared_with_id uuid NOT NULL,
  permission text NOT NULL DEFAULT 'view',
  can_view_evidence boolean NOT NULL DEFAULT false,
  donation_required boolean NOT NULL DEFAULT false,
  donation_paid boolean NOT NULL DEFAULT false,
  donation_amount integer,
  donation_paid_at timestamptz,
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE evidence_claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE pending_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  submitter_id uuid NOT NULL,
  description text NOT NULL,
  file_name text,
  file_url text,
  exhibit_id text,
  method text,
  url_link text,
  book_of_deeds_ref text,
  number_of_pages integer,
  date_submitted date,
  status text NOT NULL DEFAULT 'pending',
  reviewer_notes text,
  submitted_at timestamptz DEFAULT now() NOT NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE claim_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_claims ENABLE ROW LEVEL SECURITY; 
ALTER TABLE pending_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;