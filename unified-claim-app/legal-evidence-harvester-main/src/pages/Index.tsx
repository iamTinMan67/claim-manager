
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClaims, Claim } from "@/hooks/useClaims";
import { useEvidence } from "@/hooks/useEvidence";
import { Evidence } from "@/types/evidence";
import { LoadingScreen } from "@/components/Index/LoadingScreen";
import { WelcomeScreen } from "@/components/Index/WelcomeScreen";
import { MainDashboard } from "@/components/Index/MainDashboard";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showAddClaim, setShowAddClaim] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  
  const { claims, loading: claimsLoading, addClaim, deleteClaim, updateClaim } = useClaims();
  const { 
    evidence, 
    loading: evidenceLoading, 
    addEvidence, 
    updateEvidence,
    deleteEvidence, 
    linkEvidenceToClaim, 
    unlinkEvidenceFromClaim,
    reorderEvidence
  } = useEvidence();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Show loading while checking auth or if not authenticated
  if (authLoading || !user) {
    return <LoadingScreen />;
  }

  const handleAddClaim = async (claimData: Parameters<typeof addClaim>[0]) => {
    await addClaim(claimData);
    setShowAddClaim(false);
  };

  const handleAddEvidence = async (evidenceData: Omit<Evidence, "id" | "claimIds" | "display_order">, claimIds: string[]) => {
    console.log('Index handleAddEvidence called with:', evidenceData, claimIds);
    await addEvidence(evidenceData, claimIds);
  };

  const handleRemoveEvidence = async (evidenceId: string) => {
    await deleteEvidence(evidenceId);
  };

  const handleLinkEvidence = async (evidenceId: string, claimId: string) => {
    await linkEvidenceToClaim(evidenceId, claimId);
  };

  const handleUnlinkEvidence = async (evidenceId: string, claimId: string) => {
    await unlinkEvidenceFromClaim(evidenceId, claimId);
  };

  const handleDeleteClaim = async (claimId: string) => {
    await deleteClaim(claimId);
    // Clear selected claim if it was deleted
    if (selectedClaimId === claimId) {
      setSelectedClaimId(null);
    }
  };

  const handleUpdateEvidence = async (evidenceId: string, updates: Partial<Evidence>) => {
    await updateEvidence(evidenceId, updates);
  };

  const handleReorderEvidence = async (evidenceList: Evidence[]) => {
    await reorderEvidence(evidenceList);
  };

  const handleUpdateClaim = async (claimId: string, updates: Partial<Claim>) => {
    await updateClaim(claimId, updates);
  };

  // Show welcome message if no claims exist yet
  if (!claimsLoading && claims.length === 0) {
    return (
      <WelcomeScreen
        showAddClaim={showAddClaim}
        setShowAddClaim={setShowAddClaim}
        onAddClaim={handleAddClaim}
      />
    );
  }

  return (
    <MainDashboard
      claims={claims}
      evidence={evidence}
      claimsLoading={claimsLoading}
      selectedClaimId={selectedClaimId}
      setSelectedClaimId={setSelectedClaimId}
      showAddClaim={showAddClaim}
      setShowAddClaim={setShowAddClaim}
      onAddClaim={handleAddClaim}
      onAddEvidence={handleAddEvidence}
      onRemoveEvidence={handleRemoveEvidence}
      onLinkEvidence={handleLinkEvidence}
      onUnlinkEvidence={handleUnlinkEvidence}
      onDeleteClaim={handleDeleteClaim}
      onUpdateEvidence={handleUpdateEvidence}
      onReorderEvidence={handleReorderEvidence}
      onUpdateClaim={handleUpdateClaim}
    />
  );
};

export default Index;
