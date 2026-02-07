export interface Claim {
  claim_id: string; // Internal UUID primary key
  case_number: string; // Human-readable identifier
  title: string;
  court: string | null;
  plaintiff_name: string | null;
  defendant_name: string | null;
  /** Court contact number (displayed as "Court Number") */
  contact_number: string | null;
  /** Court email (displayed as "Court Email") */
  email: string | null;
  /** Claimant email */
  claimant_email: string | null;
  /** Claimant contact number */
  claimant_contact_number: string | null;
  description: string | null;
  status: 'Active' | 'Pending' | 'Closed';
  color?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type ClaimInput = Omit<Claim, 'created_at' | 'updated_at'>;
export type ClaimUpdate = Partial<Omit<Claim, 'case_number' | 'created_at' | 'updated_at'>>;