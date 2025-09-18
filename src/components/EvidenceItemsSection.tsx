import { useState } from "react";
import { Claim } from "@/types/claim";
import { Evidence } from "@/types/evidence";
import { EvidenceTable } from "./EvidenceTable";
import { AddEvidenceModal } from "./AddEvidenceModal";
import { LinkEvidenceModal } from "./LinkEvidenceModal";

interface Props {
  claim: Claim;
  evidenceList: Evidence[];
  onAddEvidence: (evidence: Omit<Evidence, "id" | "claimIds">, claimIds: string[]) => void;
  onRemoveEvidence: (evidenceId: string) => void;
  onLinkEvidence: (evidenceId: string, claimId: string) => void;
  onUnlinkEvidence: (evidenceId: string, claimId: string) => void;
  onUpdateEvidence: (evidenceId: string, updates: Partial<Evidence>) => void;
  onReorderEvidence: (evidenceList: Evidence[]) => void;
}

export const EvidenceItemsSection = ({
  claim,
  evidenceList,
  onAddEvidence,
  onRemoveEvidence,
  onLinkEvidence,
  onUnlinkEvidence,
  onUpdateEvidence,
  onReorderEvidence,
}: Props) => {
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [showLinkEvidence, setShowLinkEvidence] = useState(false);

  const claimEvidence = evidenceList.filter(evidence => evidence.claimIds.includes(claim.case_number));

  const handleAddEvidence = (evidence: Omit<Evidence, "id" | "claimIds">) => {
    onAddEvidence(evidence, [claim.case_number]);
    setShowAddEvidence(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Evidence Items</h3>
        <div className="space-x-2">
          <button
            onClick={() => setShowLinkEvidence(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            Link Existing Evidence
          </button>
          <button
            onClick={() => setShowAddEvidence(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            Add New Evidence
          </button>
        </div>
      </div>

      <EvidenceTable 
        evidenceList={claimEvidence}
        onRemove={onRemoveEvidence}
        showClaimInfo={false}
        onUnlinkFromClaim={(evidenceId) => onUnlinkEvidence(evidenceId, claim.case_number)}
        onUpdateEvidence={onUpdateEvidence}
        onReorderEvidence={onReorderEvidence}
      />

      {showAddEvidence && (
        <AddEvidenceModal
          onClose={() => setShowAddEvidence(false)}
          onAdd={handleAddEvidence}
        />
      )}

      {showLinkEvidence && (
        <LinkEvidenceModal
          claim={claim}
          availableEvidence={evidenceList.filter(e => !e.claimIds.includes(claim.case_number))}
          onClose={() => setShowLinkEvidence(false)}
          onLink={onLinkEvidence}
        />
      )}
    </div>
  );
};