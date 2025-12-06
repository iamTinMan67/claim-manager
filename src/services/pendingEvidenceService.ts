import { supabase } from '@/integrations/supabase/client';
import { PendingEvidence, PendingEvidenceSubmission } from '@/types/pendingEvidence';

export class PendingEvidenceService {
  // Get all pending evidence for a claim (for claim owners)
  static async getPendingEvidenceForClaim(claimId: string): Promise<PendingEvidence[]> {
    const { data, error } = await supabase
      .from('pending_evidence')
      .select(`
        *,
        submitter:profiles!submitter_id(id, email, full_name)
      `)
      .eq('claim_id', claimId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any;
  }

  // Get pending evidence submitted by current user
  static async getMyPendingEvidence(): Promise<PendingEvidence[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('pending_evidence')
      .select('*')
      .eq('submitter_id', user.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any;
  }

  // Submit new pending evidence
  static async submitPendingEvidence(evidenceData: PendingEvidenceSubmission): Promise<PendingEvidence> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('pending_evidence')
      .insert({
        ...evidenceData,
        submitter_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }

  // Approve pending evidence (claim owners only)
  static async approvePendingEvidence(pendingId: string, reviewerNotes?: string): Promise<string> {
    const { data, error } = await supabase.rpc('approve_pending_evidence' as any, {
      pending_id: pendingId,
      reviewer_notes_param: reviewerNotes || null,
    });

    if (error) throw error;
    return data as string; // Returns the new evidence ID
  }

  // Reject pending evidence (claim owners only)
  static async rejectPendingEvidence(pendingId: string, reviewerNotes: string): Promise<void> {
    const { error } = await supabase.rpc('reject_pending_evidence' as any, {
      pending_id: pendingId,
      reviewer_notes_param: reviewerNotes,
    });

    if (error) throw error;
  }

  // Update pending evidence submission (before approval/rejection)
  static async updatePendingEvidence(pendingId: string, updates: Partial<PendingEvidenceSubmission>): Promise<void> {
    const { error } = await supabase
      .from('pending_evidence')
      .update(updates)
      .eq('id', pendingId)
      .eq('status', 'pending'); // Only allow updates to pending items

    if (error) throw error;
  }

  // Delete pending evidence (submitter or claim owner)
  static async deletePendingEvidence(pendingId: string): Promise<void> {
    const { error } = await supabase
      .from('pending_evidence')
      .delete()
      .eq('id', pendingId);

    if (error) throw error;
  }
}