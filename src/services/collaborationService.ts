import { supabase } from '@/integrations/supabase/client';
import { ClaimShare, SharePermissions, UserProfile } from '@/types/collaboration';

export class CollaborationService {
  // Get all shares for a claim (for claim owners)
  static async getClaimShares(claimId: string): Promise<ClaimShare[]> {
    const { data, error } = await supabase
      .from('claim_shares')
      .select(`
        *,
        shared_with:profiles!shared_with_id(email, full_name)
      `)
      .eq('claim_id', claimId);

    if (error) throw error;
    return data || [];
  }

  // Get shares where current user is the recipient
  static async getSharedWithMe(): Promise<ClaimShare[]> {
    const { data, error } = await supabase
      .from('claim_shares')
      .select(`
        *,
        claim:claims(id, title, case_number, status),
        owner:profiles!owner_id(email, full_name)
      `)
      .eq('shared_with_id', (await supabase.auth.getUser()).data.user?.id);

    if (error) throw error;
    return data || [];
  }

  // Search for users by email
  static async searchUsers(query: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', `%${query}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  }

  // Share a claim with a user
  static async shareClaimWithUser(
    claimId: string,
    userEmail: string,
    permissions: SharePermissions
  ): Promise<ClaimShare> {
    // First, find the user by email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    // Get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error('Not authenticated');

    // Check if share already exists
    const { data: existingShare } = await supabase
      .from('claim_shares')
      .select('*')
      .eq('claim_id', claimId)
      .eq('shared_with_id', user.id)
      .single();

    if (existingShare) {
      throw new Error('Claim is already shared with this user');
    }

    // Get current collaborator count
    const { count: currentCount } = await supabase
      .from('claim_shares')
      .select('*', { count: 'exact' })
      .eq('claim_id', claimId);

    const newCollaboratorCount = (currentCount || 0) + 1;

    // Check collaborator limit
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_collaborator_limit' as any, {
        claim_id_param: claimId, 
        new_collaborator_count: newCollaboratorCount 
      });

    if (limitError) {
      throw new Error('Failed to check collaborator limit');
    }

    // Parse the JSON response properly
    const limitResult = typeof limitCheck === 'string' ? JSON.parse(limitCheck) : limitCheck;

    // If exceeds 50 collaborators, send email notification and prevent sharing
    if (!limitResult.allowed && limitResult.email_required) {
      // Send email notification to claim owner
      try {
        await supabase.functions.invoke('send-collaborator-notification', {
          body: {
            claimId,
            collaboratorCount: newCollaboratorCount,
            donationAmount: limitResult.amount
          }
        });
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }

      throw new Error(`Collaborator limit of 50 reached. An email with donation instructions (£${limitResult.amount / 100}) has been sent to the claim owner.`);
    }

    // Check if donation is required for normal tiered pricing (under 50)
    const { data: donationRequired } = await supabase
      .rpc('is_donation_required_for_share' as any, { claim_id_param: claimId });

    // Create the share
    const { data, error } = await supabase
      .from('claim_shares')
      .insert({
        claim_id: claimId,
        owner_id: currentUser.id,
        shared_with_id: user.id,
        permission: 'view',
        can_view_evidence: permissions.can_view_evidence,
        donation_required: donationRequired || false,
        donation_paid: false,
      })
      .select(`
        *,
        shared_with:profiles!shared_with_id(email, full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  // Create donation payment session
  static async createDonationPayment(claimId: string, shareId: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('create-donation-payment', {
      body: { claimId, shareId }
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.url;
  }

  // Verify donation payment
  static async verifyDonationPayment(sessionId: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('verify-donation-payment', {
      body: { sessionId }
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.success;
  }

  // Update share permissions
  static async updateSharePermissions(
    shareId: string,
    permissions: SharePermissions
  ): Promise<void> {
    const { error } = await supabase
      .from('claim_shares')
      .update(permissions)
      .eq('id', shareId);

    if (error) throw error;
  }

  // Remove a share
  static async removeShare(shareId: string): Promise<void> {
    const { error } = await supabase
      .from('claim_shares')
      .delete()
      .eq('id', shareId);

    if (error) throw error;
  }

  // Check if current user can edit a claim
  static async canEditClaim(claimId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if user owns the claim
    const { data: claim } = await supabase
      .from('claims')
      .select('user_id')
      .eq('case_number', claimId)
      .single();

    return claim?.user_id === user.id;
  }

  // Check if current user has specific permissions for a claim
  static async getClaimPermissions(claimId: string): Promise<{
    canEdit: boolean;
    canViewEvidence: boolean;
    canSubmitEvidence: boolean;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        canEdit: false,
        canViewEvidence: false,
        canSubmitEvidence: false,
      };
    }

    // Check if user owns the claim
    const { data: claim } = await supabase
      .from('claims')
      .select('user_id')
      .eq('case_number', claimId)
      .single();

    if (claim?.user_id === user.id) {
      // Owner has all permissions
      return {
        canEdit: true,
        canViewEvidence: true,
        canSubmitEvidence: true,
      };
    }

    // Check shared permissions
    const { data: share } = await supabase
      .from('claim_shares')
      .select('*')
      .eq('claim_id', claimId)
      .eq('shared_with_id', user.id)
      .single();

    if (!share) {
      return {
        canEdit: false,
        canViewEvidence: false,
        canSubmitEvidence: false,
      };
    }

    return {
      canEdit: false, // Basic claim info is never editable by shared users
      canViewEvidence: share.can_view_evidence,
      canSubmitEvidence: share.can_view_evidence, // Can submit if can view
    };
  }
}