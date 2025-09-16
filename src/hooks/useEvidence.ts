
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Evidence } from '@/types/evidence';
import { EvidenceService } from '@/services/evidenceService';
import { useEvidenceErrors } from '@/hooks/useEvidenceErrors';
import { isAuthError, retryWithReauth } from '@/utils/authUtils';

export const useEvidence = () => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, session } = useAuth();
  const { handleError, handleSuccess, handleWarning } = useEvidenceErrors();

  const fetchEvidence = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const result = await retryWithReauth(async () => {
        return await EvidenceService.fetchEvidence();
      });
      setEvidence(result);
    } catch (error) {
      console.error('Failed to fetch evidence:', error);
      if (isAuthError(error)) {
        handleError(error, 'fetch evidence - authentication required');
      } else {
        handleError(error, 'fetch evidence');
      }
    } finally {
      setLoading(false);
    }
  };

  const addEvidence = async (evidenceData: Omit<Evidence, 'id' | 'created_at' | 'updated_at' | 'claimIds' | 'display_order'>, claimIds: string[] = []) => {
    if (!user) return;

    console.log('Adding evidence with data:', evidenceData);
    console.log('Claim IDs to link:', claimIds);

    try {
      const data = await EvidenceService.createEvidence(evidenceData, user.id);

      // Link evidence to claims if provided
      if (claimIds.length > 0) {
        try {
          await EvidenceService.linkEvidenceToClaims(data.id, claimIds);
        } catch (linkError) {
          console.error('Error linking evidence to claims:', linkError);
          handleWarning('Evidence created but failed to link to claims');
        }
      }

      // Refresh evidence list to show the new item
      await fetchEvidence();
      
      handleSuccess('Evidence created successfully');
      return data;
    } catch (error) {
      handleError(error, 'create evidence');
      return null;
    }
  };

  const updateEvidence = async (evidenceId: string, updates: Partial<Evidence>) => {
    if (!user) return;

    try {
      // Get current evidence to handle file updates
      const currentEvidence = evidence.find(e => e.id === evidenceId);
      const oldFileUrl = currentEvidence?.file_url;

      // If we're updating file information, handle file deletion
      if (updates.file_url !== undefined && oldFileUrl && updates.file_url !== oldFileUrl) {
        await EvidenceService.updateEvidenceFile(evidenceId, updates.file_url, updates.file_name || null, oldFileUrl);
      } else {
        await EvidenceService.updateEvidence(evidenceId, updates);
      }
      
      await fetchEvidence(); // Refresh to get updated data
      handleSuccess('Evidence updated successfully');
    } catch (error) {
      handleError(error, 'update evidence');
    }
  };

  const deleteEvidence = async (id: string) => {
    if (!user) return;

    try {
      await EvidenceService.deleteEvidence(id);
      setEvidence(prev => prev.filter(item => item.id !== id));
      handleSuccess('Evidence deleted successfully');
    } catch (error) {
      handleError(error, 'delete evidence');
    }
  };

  const linkEvidenceToClaim = async (evidenceId: string, claimId: string) => {
    if (!user) return;

    try {
      await EvidenceService.linkEvidenceToClaim(evidenceId, claimId);
      await fetchEvidence(); // Refresh to get updated relationships
      handleSuccess('Evidence linked to claim successfully');
    } catch (error) {
      handleError(error, 'link evidence to claim');
    }
  };

  const unlinkEvidenceFromClaim = async (evidenceId: string, claimId: string) => {
    if (!user) return;

    try {
      await EvidenceService.unlinkEvidenceFromClaim(evidenceId, claimId);
      await fetchEvidence(); // Refresh to get updated relationships
      handleSuccess('Evidence unlinked from claim successfully');
    } catch (error) {
      handleError(error, 'unlink evidence from claim');
    }
  };

  const reorderEvidence = async (evidenceList: Evidence[]) => {
    if (!user) return;

    try {
      await EvidenceService.reorderEvidence(evidenceList);
      await fetchEvidence(); // Refresh to get updated data
      handleSuccess('Evidence reordered successfully');
    } catch (error) {
      handleError(error, 'reorder evidence');
    }
  };

  useEffect(() => {
    if (user && session) {
      console.log('User and session available, fetching evidence...');
      fetchEvidence();
    } else if (!user) {
      console.log('No user, clearing evidence');
      setEvidence([]);
      setLoading(false);
    }
  }, [user, session]);

  return {
    evidence,
    loading,
    addEvidence,
    updateEvidence,
    deleteEvidence,
    linkEvidenceToClaim,
    unlinkEvidenceFromClaim,
    reorderEvidence,
    refetch: fetchEvidence,
  };
};

// Re-export the Evidence type for backward compatibility
export type { Evidence } from '@/types/evidence';
