import { useState } from "react";
import { Evidence } from "@/types/evidence";
import { Claim } from "@/types/claim";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Checkbox } from "./ui/checkbox";
import { X } from "lucide-react";

interface Props {
  unlinkedEvidence: Evidence[];
  claims: Claim[];
  onClose: () => void;
  onLinkEvidence: (evidenceId: string, claimId: string) => void;
}

export const UnlinkedEvidenceModal = ({ unlinkedEvidence, claims, onClose, onLinkEvidence }: Props) => {
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>("");

  const handleToggleEvidence = (evidenceId: string) => {
    setSelectedEvidence(prev => 
      prev.includes(evidenceId) 
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleLinkSelected = async () => {
    if (!selectedClaimId || selectedEvidence.length === 0) return;

    for (const evidenceId of selectedEvidence) {
      await onLinkEvidence(evidenceId, selectedClaimId);
    }
    
    setSelectedEvidence([]);
    setSelectedClaimId("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Bulk Link Evidence to Claims</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="mb-4 flex items-center space-x-4">
          <label className="text-sm font-medium">Link to Claim:</label>
          <Select value={selectedClaimId} onValueChange={setSelectedClaimId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose a Claim" />
            </SelectTrigger>
            <SelectContent>
              {claims.map(claim => (
                <SelectItem key={claim.case_number} value={claim.case_number}>
                  {claim.case_number} - {claim.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedEvidence.length === unlinkedEvidence.length && unlinkedEvidence.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEvidence(unlinkedEvidence.map(e => e.id));
                      } else {
                        setSelectedEvidence([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Date Submitted</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unlinkedEvidence.map((evidence) => (
                <TableRow key={evidence.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedEvidence.includes(evidence.id)}
                      onCheckedChange={() => handleToggleEvidence(evidence.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {evidence.file_name || evidence.url_link || evidence.book_of_deeds_ref || 'Untitled'}
                  </TableCell>
                  <TableCell>{evidence.number_of_pages || 'N/A'}</TableCell>
                  <TableCell>{evidence.date_submitted || 'N/A'}</TableCell>
                  <TableCell>{evidence.method || 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedEvidence.length} of {unlinkedEvidence.length} evidence items selected
          </p>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleLinkSelected}
              disabled={!selectedClaimId || selectedEvidence.length === 0}
            >
              Link Selected Evidence
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};