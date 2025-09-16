
import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { ClaimsList } from "@/components/ClaimsList";
import { AddClaimModal } from "@/components/AddClaimModal";
import { ClaimEvidenceManager } from "@/components/ClaimEvidenceManager";
import { EvidenceItemsSection } from "@/components/EvidenceItemsSection";

import { Claim } from "@/types/claim";
import { Evidence } from "@/types/evidence";

interface Props {
  claims: Claim[];
  evidence: Evidence[];
  claimsLoading: boolean;
  selectedClaimId: string | null;
  setSelectedClaimId: (id: string | null) => void;
  showAddClaim: boolean;
  setShowAddClaim: (show: boolean) => void;
  onAddClaim: (claimData: any) => Promise<void>;
  onAddEvidence: (evidenceData: Omit<Evidence, "id" | "claimIds" | "display_order">, claimIds: string[]) => Promise<void>;
  onRemoveEvidence: (evidenceId: string) => Promise<void>;
  onLinkEvidence: (evidenceId: string, claimId: string) => Promise<void>;
  onUnlinkEvidence: (evidenceId: string, claimId: string) => Promise<void>;
  onDeleteClaim: (claimId: string) => Promise<void>;
  onUpdateEvidence: (evidenceId: string, updates: Partial<Evidence>) => Promise<void>;
  onReorderEvidence: (evidenceList: Evidence[]) => Promise<void>;
  onUpdateClaim: (claimId: string, updates: Partial<Claim>) => Promise<void>;
}

export const MainDashboard = ({
  claims,
  evidence,
  claimsLoading,
  selectedClaimId,
  setSelectedClaimId,
  showAddClaim,
  setShowAddClaim,
  onAddClaim,
  onAddEvidence,
  onRemoveEvidence,
  onLinkEvidence,
  onUnlinkEvidence,
  onDeleteClaim,
  onUpdateEvidence,
  onReorderEvidence,
  onUpdateClaim,
}: Props) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto p-4">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">
            Multi-Claim Evidence Management System
          </h1>



          <div className="space-y-6">
            {/* Claims List - Only show when no claim is selected */}
            {!selectedClaimId && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Claims</h2>
                  <button
                    onClick={() => setShowAddClaim(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    Add Claim
                  </button>
                </div>
                
                {claimsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading claims...</p>
                  </div>
                ) : (
                  <ClaimsList 
                    claims={claims}
                    selectedClaimId={selectedClaimId}
                    onSelectClaim={setSelectedClaimId}
                    evidenceList={evidence}
                  />
                )}
              </div>
            )}

            {/* Evidence Items Section - Show when claim is selected */}
            {selectedClaimId && (
              <EvidenceItemsSection
                claim={claims.find(c => c.case_number === selectedClaimId)!}
                evidenceList={evidence}
                onAddEvidence={onAddEvidence}
                onRemoveEvidence={onRemoveEvidence}
                onLinkEvidence={onLinkEvidence}
                onUnlinkEvidence={onUnlinkEvidence}
                onUpdateEvidence={onUpdateEvidence}
                onReorderEvidence={onReorderEvidence}
              />
            )}

            {/* Claim Management - Show when claim is selected */}
            {selectedClaimId && (
              <ClaimEvidenceManager
                claim={claims.find(c => c.case_number === selectedClaimId)!}
                evidenceList={evidence}
                allClaims={claims}
                onAddEvidence={onAddEvidence}
                onRemoveEvidence={onRemoveEvidence}
                onLinkEvidence={onLinkEvidence}
                onUnlinkEvidence={onUnlinkEvidence}
                onDeleteClaim={onDeleteClaim}
                onUpdateEvidence={onUpdateEvidence}
                onReorderEvidence={onReorderEvidence}
                onUpdateClaim={onUpdateClaim}
                hideEvidenceTab={true}
              />
            )}

            {/* Instructions when no claim selected */}
            {!selectedClaimId && (
              <div className="text-center text-gray-500 mt-20">
                <h3 className="text-lg font-medium mb-2">Select a claim to manage evidence</h3>
                <p>Choose a claim from the list above to view and manage its evidence.</p>
              </div>
            )}
          </div>

          {showAddClaim && (
            <AddClaimModal
              onClose={() => setShowAddClaim(false)}
              onAdd={onAddClaim}
            />
          )}
        </div>
      </div>
    </div>
  );
};
