export interface ClaimShare {
  id: string;
  claim_id: string;
  owner_id: string;
  shared_with_id: string;
  permission: 'view' | 'edit';
  can_view_evidence: boolean;
  donation_required: boolean;
  donation_paid: boolean;
  donation_amount?: number;
  stripe_payment_intent_id?: string;
  donation_paid_at?: string;
  created_at: string;
  updated_at: string;
  shared_with?: any;
  claim?: any;
  owner?: any;
}

export interface SharePermissions {
  can_view_evidence: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
}