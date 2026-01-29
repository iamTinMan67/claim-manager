import { useState, useEffect } from "react";
import { Claim } from "@/hooks/useClaims";
import { Evidence } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { supabase } from "@/integrations/supabase/client";
import { EvidenceService } from "@/services/evidenceService";
import { getClaimIdFromCaseNumber } from "@/utils/claimUtils";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EvidenceWithClaimIds extends Evidence {
  claimIds?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentClaimCaseNumber: string;
  currentClaimTitle: string;
  availableEvidence: EvidenceWithClaimIds[];
  onSuccess?: () => void;
}

export const CopyEvidenceModal = ({ 
  open, 
  onOpenChange, 
  currentClaimCaseNumber,
  currentClaimTitle,
  availableEvidence,
  onSuccess 
}: Props) => {
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [selectedTargetClaim, setSelectedTargetClaim] = useState<string>("");
  const [userClaims, setUserClaims] = useState<Claim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [linking, setLinking] = useState(false);

  // Fetch user's private claims when modal opens
  useEffect(() => {
    if (open) {
      fetchUserClaims();
    } else {
      // Reset state when modal closes
      setSelectedEvidence([]);
      setSelectedTargetClaim("");
    }
  }, [open]);

  const fetchUserClaims = async () => {
    setLoadingClaims(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to copy evidence",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title, court')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUserClaims(data || []);
    } catch (error: any) {
      console.error('Error fetching user claims:', error);
      toast({
        title: "Error",
        description: "Failed to load your claims",
        variant: "destructive",
      });
    } finally {
      setLoadingClaims(false);
    }
  };

  const handleToggleEvidence = (evidenceId: string) => {
    setSelectedEvidence(prev => 
      prev.includes(evidenceId)
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleCopySelected = async () => {
    if (!selectedTargetClaim || selectedEvidence.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select evidence items and a target claim",
        variant: "destructive",
      });
      return;
    }

    setLinking(true);
    try {
      // Get the claim_id for the target claim
      const targetClaimId = await getClaimIdFromCaseNumber(selectedTargetClaim);
      if (!targetClaimId) {
        throw new Error("Could not find target claim");
      }

      // Calculate next exhibit number for target claim (before loop, so multiple items get sequential numbers)
      let nextExhibitNumber = 1;
      try {
        const { data: linkRows } = await supabase
          .from('evidence_claims')
          .select('evidence_id')
          .eq('claim_id', targetClaimId);
        
        if (linkRows && linkRows.length > 0) {
          const linkedIds = linkRows.map(r => r.evidence_id).filter(Boolean);
          if (linkedIds.length > 0) {
            const { data: evidenceRows } = await supabase
              .from('evidence')
              .select('exhibit_number')
              .in('id', linkedIds);
            
            if (evidenceRows) {
              let maxNum = 0;
              evidenceRows.forEach((row: any) => {
                if (row.exhibit_number && Number.isFinite(row.exhibit_number)) {
                  maxNum = Math.max(maxNum, Number(row.exhibit_number));
                }
              });
              nextExhibitNumber = maxNum + 1;
            }
          }
        }
      } catch (err) {
        console.warn('Could not calculate next exhibit number, defaulting to 1', err);
      }

      // CLONE each selected evidence item to the target claim (no re-upload; same file_url),
      // so reordering/renumbering in one claim never affects another claim.
      let successCount = 0;
      let errorCount = 0;

      for (const evidenceId of selectedEvidence) {
        try {
          // Fetch source evidence row to clone
          const { data: src, error: srcErr } = await supabase
            .from('evidence')
            .select('*')
            .eq('id', evidenceId)
            .maybeSingle()
          if (srcErr) throw srcErr
          if (!src) throw new Error('Evidence not found')

          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')

          // Insert new evidence row - only copy file-related fields, not metadata
          // This allows each claim to have independent method/exhibit/description
          const { data: cloned, error: insErr } = await supabase
            .from('evidence')
            .insert([{
              user_id: user.id,
              case_number: selectedTargetClaim,
              // Copy file information (same physical file, just linked)
              file_name: (src as any).file_name,
              file_url: (src as any).file_url,
              file_size: (src as any).file_size,
              file_type: (src as any).file_type,
              number_of_pages: (src as any).number_of_pages,
              date_submitted: (src as any).date_submitted,
              // Copy title for reference (user can edit later)
              title: (src as any).title || (src as any).name,
              // Set default method to To-Do (per-claim, independent)
              method: 'To-Do',
              // Assign next sequential exhibit number for this claim
              exhibit_number: nextExhibitNumber++,
              // Do NOT copy: description, display_order, 
              // book_of_deeds_ref, url_link (these stay per-claim)
            }])
            .select('id')
            .single()
          if (insErr) throw insErr
          const clonedId = cloned?.id
          if (!clonedId) throw new Error('Clone failed')

          // Link cloned evidence to the target claim
          const { error: linkErr } = await supabase
            .from('evidence_claims')
            .insert([{ evidence_id: clonedId, claim_id: targetClaimId }])
          if (linkErr) throw linkErr

          successCount++;
        } catch (error: any) {
          console.error(`Error cloning evidence ${evidenceId}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast({
          title: "Success",
          description: `Successfully copied ${successCount} evidence item(s) to your claim`,
          variant: "default",
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Partial Success",
          description: `Copied ${successCount} item(s), ${errorCount} failed`,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error('Error copying evidence:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to copy evidence",
        variant: "destructive",
      });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Copy Evidence to Your Claim</DialogTitle>
          <p className="text-sm text-gray-500 mt-2">
            Copy evidence from "{currentClaimTitle}" to one of your own claims. The same file will be shared between both claims.
          </p>
        </DialogHeader>
        
        {/* Target Claim Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Copy to Claim:</label>
          {loadingClaims ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your claims...
            </div>
          ) : (
            <Select value={selectedTargetClaim} onValueChange={setSelectedTargetClaim}>
              <SelectTrigger>
                <SelectValue placeholder="Select a claim to copy evidence to" />
              </SelectTrigger>
              <SelectContent>
                {userClaims.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">No claims found. Create a claim first.</div>
                ) : (
                  userClaims.map(claim => (
                    <SelectItem key={claim.case_number} value={claim.case_number}>
                      {claim.case_number} - {claim.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Evidence Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Evidence to Copy:</label>
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
            {availableEvidence.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No evidence available to copy from this claim.
              </p>
            ) : (
              availableEvidence.map((evidence) => (
                <div key={evidence.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id={evidence.id}
                    checked={selectedEvidence.includes(evidence.id)}
                    onCheckedChange={() => handleToggleEvidence(evidence.id)}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">
                        {evidence.file_name || evidence.title || evidence.name || 'Evidence item'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(evidence.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {evidence.file_name && (
                      <p className="text-xs text-blue-600 mt-1">
                        File: {evidence.file_name}
                      </p>
                    )}
                    {evidence.claimIds && evidence.claimIds.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Currently linked to {evidence.claimIds.length} claim(s)
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linking}>
            Cancel
          </Button>
          <Button 
            onClick={handleCopySelected}
            disabled={selectedEvidence.length === 0 || !selectedTargetClaim || linking}
          >
            {linking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Copying...
              </>
            ) : (
              `Copy Selected (${selectedEvidence.length})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
