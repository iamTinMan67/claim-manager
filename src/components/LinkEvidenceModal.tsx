
import { useState } from "react";
import { Claim } from "@/hooks/useClaims";
import { Evidence } from "@/types/evidence";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";

interface Props {
  claim: Claim;
  availableEvidence: Evidence[];
  onClose: () => void;
  onLink: (evidenceId: string, claimId: string) => void;
}

export const LinkEvidenceModal = ({ claim, availableEvidence, onClose, onLink }: Props) => {
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);

  const handleToggleEvidence = (evidenceId: string) => {
    setSelectedEvidence(prev => 
      prev.includes(evidenceId)
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleLinkSelected = () => {
    selectedEvidence.forEach(evidenceId => {
      onLink(evidenceId, claim.case_number);
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Link Existing Evidence to {claim.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {availableEvidence.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No additional evidence available to link.
            </p>
          ) : (
            availableEvidence.map((evidence) => (
              <div key={evidence.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={evidence.id}
                  checked={selectedEvidence.includes(evidence.id)}
                  onCheckedChange={() => handleToggleEvidence(evidence.id)}
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">Evidence</span>
                    <span className="text-xs text-gray-500">{new Date(evidence.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700">{evidence.file_name || 'Evidence item'}</p>
                  {evidence.file_name && (
                    <p className="text-xs text-blue-600 mt-1">
                      File: {evidence.file_name}
                    </p>
                  )}
                  {evidence.claimIds.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      Currently linked to {evidence.claimIds.length} other claim(s)
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleLinkSelected}
            disabled={selectedEvidence.length === 0}
          >
            Link Selected ({selectedEvidence.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
