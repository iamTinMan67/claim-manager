export interface Claim {
  case_number: string; // Primary key
  title: string;
  court: string | null;
  plaintiff_name: string | null;
  defendant_name: string | null;
  description: string | null;
  status: 'Active' | 'Pending' | 'Closed';
  created_at: string;
  updated_at: string;
}

export type ClaimInput = Omit<Claim, 'created_at' | 'updated_at'>;
export type ClaimUpdate = Partial<Omit<Claim, 'case_number' | 'created_at' | 'updated_at'>>;