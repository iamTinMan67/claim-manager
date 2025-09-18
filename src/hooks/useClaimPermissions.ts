import { useState, useEffect } from 'react';
import { CollaborationService } from '@/services/collaborationService';

export const useClaimPermissions = (claimId: string) => {
  const [permissions, setPermissions] = useState({
    canEdit: false,
    canViewEvidence: false,
    canSubmitEvidence: false,
  });

  useEffect(() => {
    if (claimId) {
      CollaborationService.getClaimPermissions(claimId).then(setPermissions);
    }
  }, [claimId]);

  return permissions;
};