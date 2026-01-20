import { supabase } from '@/integrations/supabase/client';
import { ClaimShare, SharePermissions, UserProfile } from '@/types/collaboration';
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils';

function normalizeClaimSharePermission(raw: unknown): ClaimShare['permission'] {
  if (raw === 'view' || raw === 'edit') return raw;

  // Least-privilege fallback: if the DB contains an unexpected value, treat it as view-only.
  // This keeps the UI working without accidentally granting edit capability.
  console.warn('Unexpected claim share permission value; defaulting to "view".', { raw });
  return 'view';
}

function toClaimShare(row: any): ClaimShare {
  return {
    ...(row ?? {}),
    permission: normalizeClaimSharePermission(row?.permission),
  } as ClaimShare;
}

function toClaimShares(rows: any[] | null): ClaimShare[] {
  return (rows ?? []).map(toClaimShare);
}

export class CollaborationService {
  // Get all shares for a claim (for claim owners)
  static async getClaimShares(claimId: string): Promise<ClaimShare[]> {
    // Convert case_number to claim_id (UUID) if needed
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    let claimIdUuid: string;
    
    if (uuidPattern.test(claimId)) {
      claimIdUuid = claimId;
    } else {
      // It's a case_number, convert to claim_id
      const resolvedClaimId = await getClaimIdFromCaseNumber(claimId);
      if (!resolvedClaimId) {
        return [];
      }
      claimIdUuid = resolvedClaimId;
    }

    const { data, error } = await supabase
      .from('claim_shares')
      .select(`
        *,
        shared_with:profiles!claim_shares_shared_with_id_fkey(email, nickname)
      `)
      .eq('claim_id', claimIdUuid);

    if (error) throw error;
    return toClaimShares(data);
  }

  // Get shares where current user is the recipient
  static async getSharedWithMe(): Promise<ClaimShare[]> {
    const { data, error } = await supabase
      .from('claim_shares')
      .select(`
        *,
        claim:claims(id, title, case_number, status),
        owner:profiles!claim_shares_owner_id_fkey(email, nickname)
      `)
      .eq('shared_with_id', (await supabase.auth.getUser()).data.user?.id);

    if (error) throw error;
    return toClaimShares(data);
  }

  // Search for users by email
  static async searchUsers(query: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .ilike('email', `%${query}%`)
      .limit(10);

    if (error) throw error;
    // Map nickname to full_name for compatibility with UserProfile interface
    return (data || []).map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.nickname || user.email || 'Unknown User'
    }));
  }

  // Share a claim with a user
  static async shareClaimWithUser(
    claimId: string,
    userEmail: string,
    permissions: SharePermissions
  ): Promise<ClaimShare> {
    // Get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error('Not authenticated');

    // Convert case_number to claim_id (UUID) if needed
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    let claimIdUuid: string;
    
    if (uuidPattern.test(claimId)) {
      claimIdUuid = claimId;
    } else {
      // It's a case_number, convert to claim_id
      const resolvedClaimId = await getClaimIdFromCaseNumber(claimId);
      if (!resolvedClaimId) {
        throw new Error('Claim not found');
      }
      claimIdUuid = resolvedClaimId;
    }

    // SECURITY: Verify current user owns the claim they're trying to share
    // Use a query that RLS can verify - check by user_id to ensure RLS policy allows access
    const { data: claimOwner, error: ownerError } = await supabase
      .from('claims')
      .select('user_id, case_number, claim_id')
      .eq('claim_id', claimIdUuid)
      .eq('user_id', currentUser.id) // Add this filter so RLS can verify ownership
      .single();

    if (ownerError || !claimOwner) {
      if (ownerError?.code === 'PGRST116') {
        // Not found - either doesn't exist or user doesn't own it
        throw new Error('Claim not found or you do not have permission to share it');
      }
      throw new Error(`Unable to verify claim ownership: ${ownerError?.message || 'Unknown error'}`);
    }

    if (claimOwner.user_id !== currentUser.id) {
      throw new Error('You can only share claims that you own');
    }

    // First, find the user by email
    // Verify the user exists and is accessible (RLS might block if profile doesn't exist properly)
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      if (userError?.code === 'PGRST116') {
        throw new Error(`User with email "${userEmail}" not found. Please ensure the user has signed up and has a profile.`);
      }
      console.error('Error finding user:', userError);
      throw new Error(`Unable to find user: ${userError?.message || 'User not found'}`);
    }

    // Verify the user ID is valid
    if (!user.id) {
      throw new Error('Invalid user profile - missing user ID');
    }

    // Don't allow sharing with yourself
    if (user.id === currentUser.id) {
      throw new Error('You cannot share a claim with yourself');
    }

    // Check if share already exists
    // Use maybeSingle() instead of single() to avoid errors if no share exists
    const { data: existingShare, error: existingShareError } = await supabase
      .from('claim_shares')
      .select(`
        id, 
        claim_id, 
        shared_with_id, 
        owner_id,
        can_view_evidence,
        donation_required,
        donation_paid,
        shared_with:profiles!claim_shares_shared_with_id_fkey(email, nickname)
      `)
      .eq('claim_id', claimIdUuid)
      .eq('shared_with_id', user.id)
      .maybeSingle();

    // Only throw error if we actually found a share (not if the query failed with "not found")
    if (existingShareError && existingShareError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine - means no share exists
      console.error('Error checking for existing share:', existingShareError);
      throw new Error(`Unable to check if share exists: ${existingShareError.message}`);
    }

    if (existingShare) {
      console.log('Existing share found:', existingShare);
      // Check if the existing share is owned by the current user
      if (existingShare.owner_id === currentUser.id) {
        // Share exists and is owned by current user - update permissions if needed, then return it
        const needsUpdate = existingShare.can_view_evidence !== permissions.can_view_evidence;
        
        if (needsUpdate) {
          // Update permissions to match what was requested
          const { error: updateError } = await supabase
            .from('claim_shares')
            .update({ can_view_evidence: permissions.can_view_evidence })
            .eq('id', existingShare.id);
          
          if (updateError) {
            console.error('Error updating existing share:', updateError);
            throw new Error(`Share exists but failed to update permissions: ${updateError.message}`);
          }
          
          // Fetch updated share
          const { data: updatedShare, error: fetchError } = await supabase
            .from('claim_shares')
            .select(`
              *,
              shared_with:profiles!claim_shares_shared_with_id_fkey(email, nickname)
            `)
            .eq('id', existingShare.id)
            .single();
          
          if (fetchError || !updatedShare) {
            throw new Error('Share exists but could not be retrieved after update');
          }
          
          return toClaimShare(updatedShare);
        } else {
          // Share exists with same permissions - just return it
          return toClaimShare(existingShare);
        }
      } else {
        // Share exists but owned by someone else - this shouldn't happen, but handle it
        throw new Error('A share for this claim and user already exists, but is owned by a different user. Please contact support.');
      }
    }

    // Get current collaborator count
    const { count: currentCount } = await supabase
      .from('claim_shares')
      .select('*', { count: 'exact' })
      .eq('claim_id', claimIdUuid);

    const newCollaboratorCount = (currentCount || 0) + 1;

    // Check collaborator limit
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_collaborator_limit' as any, {
        claim_id_param: claimIdUuid, 
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
            claimId: claimIdUuid,
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
      .rpc('is_donation_required_for_share' as any, { claim_id_param: claimIdUuid });

    // Try using an RPC function first if it exists, otherwise fall back to direct insert
    // This allows RLS policies to be handled at the database level
    try {
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('create_claim_share' as any, {
          p_claim_id: claimIdUuid,
          p_shared_with_id: user.id,
          p_permission: 'view',
          p_can_view_evidence: permissions.can_view_evidence ?? true,
          p_donation_required: donationRequired || false
        });

      // Check if RPC function exists (error code 42883 = function does not exist)
      if (rpcError) {
        // Postgres function-not-found (direct from Postgres)
        const isPgFnMissing = rpcError.code === '42883' || rpcError.message?.includes('does not exist');
        // PostgREST schema-cache function-not-found (what you're seeing in the browser)
        const isPostgrestFnMissing =
          rpcError.code === 'PGRST202' ||
          rpcError.message?.includes('Could not find the function');

        if (isPgFnMissing || isPostgrestFnMissing) {
          // Function doesn't exist, use direct insert
          console.log('RPC function create_claim_share does not exist, using direct insert');
        } else {
          // Function exists but returned an error - this might be the real issue
          console.error('RPC function error:', rpcError);
          throw new Error(`Failed to create share via RPC: ${rpcError.message}`);
        }
      } else if (rpcResult) {
        // RPC function exists and succeeded, fetch the created share
        const shareId = typeof rpcResult === 'string' ? rpcResult : (rpcResult.id || rpcResult);
        const { data: createdShare, error: fetchError } = await supabase
          .from('claim_shares')
          .select(`
            *,
            shared_with:profiles!claim_shares_shared_with_id_fkey(email, nickname)
          `)
          .eq('id', shareId)
          .single();

        if (!fetchError && createdShare) {
          return toClaimShare(createdShare);
        } else if (fetchError) {
          console.warn('RPC succeeded but could not fetch created share:', fetchError);
          // Fall through to direct insert as backup
        }
      }
    } catch (rpcErr: any) {
      // RPC function doesn't exist or failed, fall through to direct insert
      const msg = rpcErr?.message || '';
      const code = rpcErr?.code;
      const isPgFnMissing = code === '42883' || msg.includes('does not exist');
      const isPostgrestFnMissing = code === 'PGRST202' || msg.includes('Could not find the function');

      if (!isPgFnMissing && !isPostgrestFnMissing) {
        // Re-throw if it's a real error (not just "function doesn't exist")
        throw rpcErr;
      }
      console.log('RPC function not available, using direct insert');
    }

    // Fallback: Direct insert (will work if RLS policy allows)
    // The RLS policy should allow inserts where owner_id = auth.uid() and the user owns the claim
    // Ensure we have all required fields and that the user context is correct
    const shareData = {
      claim_id: claimIdUuid,
      owner_id: currentUser.id, // This must match auth.uid() for RLS to allow
      shared_with_id: user.id,
      permission: 'view' as const,
      can_view_evidence: permissions.can_view_evidence ?? true,
      donation_required: donationRequired || false,
      donation_paid: false,
    };

    // Verify ownership one final time - this query should pass RLS if we own the claim
    // This helps ensure RLS can see the relationship before we try to insert
    const { data: finalOwnershipCheck, error: ownershipError } = await supabase
      .from('claims')
      .select('claim_id, user_id')
      .eq('claim_id', claimIdUuid)
      .eq('user_id', currentUser.id)
      .single();

    if (ownershipError || !finalOwnershipCheck) {
      if (ownershipError?.code === 'PGRST116') {
        throw new Error('Claim not found or you do not own this claim. Only claim owners can share claims.');
      }
      throw new Error(`Unable to verify claim ownership: ${ownershipError?.message || 'Unknown error'}`);
    }

    // Verify target user profile is accessible (RLS might require this)
    // This ensures RLS can verify the shared_with_id user exists before insert
    const { data: targetUserCheck, error: targetUserError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (targetUserError || !targetUserCheck) {
      console.warn('Warning: Could not verify target user profile accessibility:', targetUserError);
      // Don't fail here - the user was found earlier, so this might just be an RLS visibility issue
      // But log it for debugging
    }

    // Ensure we have a fresh session before insert
    // Sometimes the auth context can get stale, causing RLS to fail
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Session expired. Please refresh the page and try again.');
    }

    // Verify the session user matches currentUser
    if (session.user.id !== currentUser.id) {
      console.error('Session mismatch:', {
        sessionUserId: session.user.id,
        currentUserId: currentUser.id
      });
      throw new Error('Session user mismatch. Please refresh the page and try again.');
    }

    // Debug: Log what auth.uid() should be (this is what RLS will check)
    console.log('Attempting insert with auth context:', {
      sessionUserId: session.user.id,
      ownerId: shareData.owner_id,
      claimId: shareData.claim_id,
      sharedWithId: shareData.shared_with_id,
      match: session.user.id === shareData.owner_id
    });

    // Now attempt the insert - RLS should allow this since:
    // 1. owner_id = currentUser.id = auth.uid() = session.user.id
    // 2. We just verified the claim exists and is owned by currentUser
    // 3. We verified the target user exists
    // 4. We verified the session is valid and matches
    const { data, error } = await supabase
      .from('claim_shares')
      .insert(shareData)
      .select(`
        *,
        shared_with:profiles!claim_shares_shared_with_id_fkey(email, nickname)
      `)
      .single();

    if (error) {
      console.error('Error creating share:', error);
      console.error('Share data attempted:', shareData);
      console.error('Current user:', currentUser.id);
      console.error('Claim ID:', claimIdUuid);
      console.error('Target user ID:', user.id);
      console.error('Ownership check result:', finalOwnershipCheck);
      
      // Provide more helpful error message
      if (error.code === '42501') {
        throw new Error('Permission denied by database security policy. The RLS policy on claim_shares requires specific conditions. Please ensure you own the claim and try again. If the issue persists, the database administrator may need to review the RLS policies.');
      }
      throw error;
    }
    return toClaimShare(data);
  }

  // Create donation payment session
  static async createDonationPayment(claimId: string, shareId: string): Promise<string> {
    // Convert case_number to claim_id (UUID) if needed
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    let claimIdUuid: string;
    
    if (uuidPattern.test(claimId)) {
      claimIdUuid = claimId;
    } else {
      // It's a case_number, convert to claim_id
      const resolvedClaimId = await getClaimIdFromCaseNumber(claimId);
      if (!resolvedClaimId) {
        throw new Error('Claim not found');
      }
      claimIdUuid = resolvedClaimId;
    }

    const { data, error } = await supabase.functions.invoke('create-donation-payment', {
      body: { claimId: claimIdUuid, shareId }
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

    // Convert case_number to claim_id (UUID) if needed
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    let claimIdUuid: string | null = null;
    
    if (uuidPattern.test(claimId)) {
      claimIdUuid = claimId;
    } else {
      // It's a case_number, convert to claim_id
      claimIdUuid = await getClaimIdFromCaseNumber(claimId);
      if (!claimIdUuid) {
        return {
          canEdit: false,
          canViewEvidence: false,
          canSubmitEvidence: false,
        };
      }
    }

    // Check if user owns the claim
    const { data: claim } = await supabase
      .from('claims')
      .select('user_id')
      .eq('claim_id', claimIdUuid)
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
      .eq('claim_id', claimIdUuid)
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