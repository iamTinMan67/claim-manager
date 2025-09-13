
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { 
  PDFFieldConfig, 
  ClaimFieldConfig, 
  EvidenceFieldConfig,
  CLAIM_FIELD_LABELS,
  EVIDENCE_FIELD_LABELS 
} from "@/types/pdfConfig";

interface Props {
  open: boolean;
  onClose: () => void;
  initialConfig: PDFFieldConfig;
  onConfirm: (config: PDFFieldConfig) => void;
}

export const PDFFieldSelector = ({ open, onClose, initialConfig, onConfirm }: Props) => {
  const [claimFields, setClaimFields] = useState<ClaimFieldConfig>(initialConfig.claimFields);
  const [evidenceFields, setEvidenceFields] = useState<EvidenceFieldConfig>(initialConfig.evidenceFields);

  const handleClaimFieldChange = (field: keyof ClaimFieldConfig, checked: boolean) => {
    setClaimFields(prev => ({ ...prev, [field]: checked }));
  };

  const handleEvidenceFieldChange = (field: keyof EvidenceFieldConfig, checked: boolean) => {
    setEvidenceFields(prev => ({ ...prev, [field]: checked }));
  };

  const handleSelectAllClaim = () => {
    const allSelected = Object.values(claimFields).every(Boolean);
    const newState = Object.keys(claimFields).reduce((acc, key) => ({
      ...acc,
      [key]: !allSelected
    }), {} as ClaimFieldConfig);
    setClaimFields(newState);
  };

  const handleSelectAllEvidence = () => {
    const allSelected = Object.values(evidenceFields).every(Boolean);
    const newState = Object.keys(evidenceFields).reduce((acc, key) => ({
      ...acc,
      [key]: !allSelected
    }), {} as EvidenceFieldConfig);
    setEvidenceFields(newState);
  };

  const handleConfirm = () => {
    // Validation: ensure at least one field is selected in each section
    const hasClaimFields = Object.values(claimFields).some(Boolean);
    const hasEvidenceFields = Object.values(evidenceFields).some(Boolean);

    if (!hasClaimFields || !hasEvidenceFields) {
      // You could show a toast here, but for simplicity we'll just return
      return;
    }

    onConfirm({
      claimFields,
      evidenceFields,
    });
    onClose();
  };

  const isValid = Object.values(claimFields).some(Boolean) && Object.values(evidenceFields).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select PDF Fields</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Claim Information Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Claim Information</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllClaim}
              >
                {Object.values(claimFields).every(Boolean) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(CLAIM_FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`claim-${key}`}
                    checked={claimFields[key as keyof ClaimFieldConfig]}
                    onCheckedChange={(checked) => 
                      handleClaimFieldChange(key as keyof ClaimFieldConfig, !!checked)
                    }
                  />
                  <Label htmlFor={`claim-${key}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Evidence Table Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Evidence Table Columns</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllEvidence}
              >
                {Object.values(evidenceFields).every(Boolean) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(EVIDENCE_FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`evidence-${key}`}
                    checked={evidenceFields[key as keyof EvidenceFieldConfig]}
                    onCheckedChange={(checked) => 
                      handleEvidenceFieldChange(key as keyof EvidenceFieldConfig, !!checked)
                    }
                  />
                  <Label htmlFor={`evidence-${key}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {!isValid && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              Please select at least one field from each section.
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Generate PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
