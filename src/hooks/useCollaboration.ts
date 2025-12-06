import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CollaborationService } from '@/services/collaborationService';
import { ClaimShare, SharePermissions, UserProfile } from '@/types/collaboration';
import { useEvidenceErrors } from '@/hooks/useEvidenceErrors';

export const useCollaboration = (claimId?: string) => {
  const [shares, setShares] = useState<ClaimShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<ClaimShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    canEdit: false,
    canViewEvidence: false,
    canSubmitEvidence: false,
  });
  const { user } = useAuth();
  const { handleError, handleSuccess } = useEvidenceErrors();

  const fetchShares = async () => {
    if (!user || !claimId) return;
    
    setLoading(true);
    try {
      const [sharesData, permissionsData] = await Promise.all([
        CollaborationService.getClaimShares(claimId),
        CollaborationService.getClaimPermissions(claimId)
      ]);
      setShares(sharesData);
      setPermissions(permissionsData);
    } catch (error) {
      handleError(error, 'fetch sharing information');
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedWithMe = async () => {
    if (!user) return;
    
    try {
      const data = await CollaborationService.getSharedWithMe();
      setSharedWithMe(data);
    } catch (error) {
      handleError(error, 'fetch shared claims');
    }
  };

  const shareClaimWithUser = async (userEmail: string, sharePermissions: SharePermissions) => {
    if (!user || !claimId) return false;

    try {
      const newShare = await CollaborationService.shareClaimWithUser(claimId, userEmail, sharePermissions);
      await fetchShares();
      
      if (newShare.donation_required && !newShare.donation_paid) {
        // Return the share ID to trigger donation flow in UI
        handleSuccess('Share created! Donation required for this collaborator.');
        return { success: true, requiresDonation: true, shareId: newShare.id };
      } else {
        handleSuccess('Claim shared successfully');
        return { success: true, requiresDonation: false };
      }
    } catch (error) {
      handleError(error, 'share claim');
      return { success: false };
    }
  };

  const createDonationPayment = async (shareId: string) => {
    if (!user || !claimId) return null;

    try {
      const paymentUrl = await CollaborationService.createDonationPayment(claimId, shareId);
      return paymentUrl;
    } catch (error) {
      handleError(error, 'create donation payment');
      return null;
    }
  };

  const verifyDonationPayment = async (sessionId: string) => {
    try {
      const success = await CollaborationService.verifyDonationPayment(sessionId);
      if (success) {
        await fetchShares();
        handleSuccess('Donation verified successfully');
      }
      return success;
    } catch (error) {
      handleError(error, 'verify donation payment');
      return false;
    }
  };

  const updateSharePermissions = async (shareId: string, sharePermissions: SharePermissions) => {
    try {
      await CollaborationService.updateSharePermissions(shareId, sharePermissions);
      await fetchShares();
      handleSuccess('Permissions updated successfully');
    } catch (error) {
      handleError(error, 'update permissions');
    }
  };

  const removeShare = async (shareId: string) => {
    try {
      await CollaborationService.removeShare(shareId);
      await fetchShares();
      handleSuccess('Share removed successfully');
    } catch (error) {
      handleError(error, 'remove share');
    }
  };

  const searchUsers = async (query: string): Promise<UserProfile[]> => {
    try {
      return await CollaborationService.searchUsers(query);
    } catch (error) {
      handleError(error, 'search users');
      return [];
    }
  };

  useEffect(() => {
    if (user && claimId) {
      fetchShares();
    }
  }, [user, claimId]);

  return {
    shares,
    sharedWithMe,
    loading,
    permissions,
    shareClaimWithUser,
    updateSharePermissions,
    removeShare,
    searchUsers,
    fetchShares,
    fetchSharedWithMe,
    createDonationPayment,
    verifyDonationPayment,
  };
};