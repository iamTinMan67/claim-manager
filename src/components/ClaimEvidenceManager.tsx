import { useState } from "react";
import { Claim } from "@/types/claim";
import { Evidence } from "@/types/evidence";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { EvidenceTable } from "./EvidenceTable";
import { AddEvidenceModal } from "./AddEvidenceModal";
import { EvidenceSummary } from "./EvidenceSummary";
import { ClaimEvidenceExport } from "./ClaimEvidenceExport";
import { LinkEvidenceModal } from "./LinkEvidenceModal";
import { UnlinkedEvidenceModal } from "./UnlinkedEvidenceModal";

import { EditableClaimInfo } from "./EditableClaimInfo";
import { ClaimSharingTab } from "./ClaimSharingTab";
import { CollaborationHub } from "./CollaborationHub";
import { Button } from "./ui/button";
import { Trash2, Download } from "lucide-react";
import { exportClaimDataToCSV } from "@/utils/claimDataExport";
import { toast } from "@/hooks/use-toast";

interface Props {
  claim: Claim;
  evidenceList: Evidence[];
  allClaims: Claim[];
  onAddEvidence: (evidence: Omit<Evidence, "id" | "claimIds">, claimIds: string[]) => void;
  onRemoveEvidence: (evidenceId: string) => void;
  onLinkEvidence: (evidenceId: string, claimId: string) => void;
  onUnlinkEvidence: (evidenceId: string, claimId: string) => void;
  onDeleteClaim: (claimId: string) => void;
  onUpdateEvidence: (evidenceId: string, updates: Partial<Evidence>) => void;
  onReorderEvidence: (evidenceList: Evidence[]) => void;
  onUpdateClaim: (claimId: string, updates: Partial<Claim>) => void;
  hideEvidenceTab?: boolean;
}

export const ClaimEvidenceManager = ({ 
  claim, 
  evidenceList, 
  allClaims,
  onAddEvidence, 
  onRemoveEvidence,
  onLinkEvidence,
  onUnlinkEvidence,
  onDeleteClaim,
  onUpdateEvidence,
  onReorderEvidence,
  onUpdateClaim,
  hideEvidenceTab = false
}: Props) => {
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [showLinkEvidence, setShowLinkEvidence] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUnlinkedMode, setIsUnlinkedMode] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);

  const claimEvidence = evidenceList.filter(evidence => evidence.claimIds.includes(claim.case_number));
  const unlinkedEvidence = evidenceList.filter(evidence => evidence.claimIds.length === 0);
  const displayedEvidence = isUnlinkedMode ? unlinkedEvidence : claimEvidence;

  const handleAddEvidence = (evidence: Omit<Evidence, "id" | "claimIds">) => {
    onAddEvidence(evidence, [claim.case_number]);
    setShowAddEvidence(false);
  };

  const handleExportAndDelete = async () => {
    try {
      await exportClaimDataToCSV(claim.case_number, claim.title);
      toast({
        title: "Export Complete",
        description: "Claim data has been exported successfully.",
      });
      onDeleteClaim(claim.case_number);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export claim data. Deletion cancelled.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClaim = () => {
    onDeleteClaim(claim.case_number);
  };

  const handleToggleSelection = (evidenceId: string) => {
    setSelectedEvidence(prev => 
      prev.includes(evidenceId) 
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleToggleUnlinkedMode = () => {
    setIsUnlinkedMode(!isUnlinkedMode);
    setSelectedEvidence([]);
  };

  const handleBulkLink = async (evidenceId: string, claimId: string) => {
    await onLinkEvidence(evidenceId, claimId);
    setSelectedEvidence(prev => prev.filter(id => id !== evidenceId));
  };

  return (
    <div className="space-y-6">
      {/* Claim Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <EditableClaimInfo claim={claim} onUpdate={onUpdateClaim} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 ml-4"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Claim
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-enhanced p-6 rounded-lg max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Claim</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this claim? This action cannot be undone. 
              All evidence will be unlinked from this claim.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              You can export all claim-related data (evidence, todos, calendar entries) before deletion.
            </p>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  handleExportAndDelete();
                  setShowDeleteConfirm(false);
                }}
                className="border-blue-300 text-blue-600 hover:bg-blue-500/20"
              >
                <Download className="w-4 h-4 mr-2" />
                Export & Delete
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  handleDeleteClaim();
                  setShowDeleteConfirm(false);
                }}
              >
                Delete Only
              </Button>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue={hideEvidenceTab ? "summary" : "evidence"} className="w-full">
        <TabsList className={`grid w-full ${hideEvidenceTab ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {!hideEvidenceTab && <TabsTrigger value="evidence">Evidence Items</TabsTrigger>}
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="sharing">Sharing</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {!hideEvidenceTab && (
          <TabsContent value="evidence" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold">Evidence Items</h3>
                <Button
                  variant={isUnlinkedMode ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleUnlinkedMode}
                >
                  {isUnlinkedMode ? 'Show Linked' : 'Show Unlinked'}
                </Button>
              </div>
              <div className="space-x-2">
                {isUnlinkedMode && selectedEvidence.length > 0 && (
                  <Button
                    onClick={() => setShowBulkLinkModal(true)}
                    className="bg-green-600 text-white hover:bg-green-700"
                    size="sm"
                  >
                    Bulk Link to Claims ({selectedEvidence.length})
                  </Button>
                )}
                {!isUnlinkedMode && (
                  <>
                    <Button
                      onClick={() => setShowLinkEvidence(true)}
                      className="bg-green-600 text-white hover:bg-green-700"
                      size="sm"
                    >
                      Link Existing Evidence
                    </Button>
                    <Button
                      onClick={() => setShowAddEvidence(true)}
                      className="bg-green-600 text-white hover:bg-green-700"
                      size="sm"
                    >
                      Add New Evidence
                    </Button>
                  </>
                )}
              </div>
            </div>

            <EvidenceTable 
              evidenceList={displayedEvidence}
              onRemove={onRemoveEvidence}
              showClaimInfo={false}
              onUnlinkFromClaim={!isUnlinkedMode ? (evidenceId) => onUnlinkEvidence(evidenceId, claim.case_number) : undefined}
              onUpdateEvidence={onUpdateEvidence}
              onReorderEvidence={onReorderEvidence}
              unlinkedMode={isUnlinkedMode}
              selectedEvidence={selectedEvidence}
              onToggleSelection={isUnlinkedMode ? handleToggleSelection : undefined}
            />
          </TabsContent>
        )}


        <TabsContent value="summary">
          <EvidenceSummary 
            evidenceCount={claimEvidence.length}
            claim={claim}
            evidenceList={claimEvidence}
            onUpdateClaim={onUpdateClaim}
          />
        </TabsContent>

        <TabsContent value="sharing">
          <ClaimSharingTab claimId={claim.case_number} />
        </TabsContent>

        <TabsContent value="export">
          <ClaimEvidenceExport 
            claim={claim}
            evidenceList={claimEvidence}
            allClaims={allClaims}
            allEvidence={evidenceList}
          />
        </TabsContent>
      </Tabs>

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

      {showBulkLinkModal && (
        <UnlinkedEvidenceModal
          unlinkedEvidence={unlinkedEvidence.filter(e => selectedEvidence.includes(e.id))}
          claims={allClaims}
          onClose={() => setShowBulkLinkModal(false)}
          onLinkEvidence={handleBulkLink}
        />
      )}
      
      <CollaborationHub claimId={claim.case_number} />
    </div>
  );
};