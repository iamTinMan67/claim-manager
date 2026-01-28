import { useState, useEffect } from "react";
import { Claim } from "@/hooks/useClaims";
import { Evidence } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { supabase } from "@/integrations/supabase/client";
import { EvidenceService } from "@/services/evidenceService";
import { getClaimIdFromCaseNumber } from "@/utils/claimUtils";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEvidenceIds: string[];
  currentClaimCaseNumber: string;
  currentClaimTitle: string;
  isGuest?: boolean;
  onSuccess?: () => void;
}

export const ShareEvidenceModal = ({ 
  open, 
  onOpenChange, 
  selectedEvidenceIds,
  currentClaimCaseNumber,
  currentClaimTitle,
  isGuest = false,
  onSuccess 
}: Props) => {
  const [selectedTargetClaim, setSelectedTargetClaim] = useState<string>("");
  const [availableClaims, setAvailableClaims] = useState<Claim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Fetch available claims when modal opens
  useEffect(() => {
    if (open) {
      fetchAvailableClaims();
    } else {
      // Reset state when modal closes
      setSelectedTargetClaim("");
    }
  }, [open, isGuest]);

  const fetchAvailableClaims = async () => {
    setLoadingClaims(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to share evidence",
          variant: "destructive",
        });
        return;
      }

      // Fetch user's private claims
      const { data: privateClaims, error: privateError } = await supabase
        .from('claims')
        .select('case_number, title, court, status')
        .eq('user_id', user.id)
        .neq('status', 'Closed')
        .order('created_at', { ascending: false });

      if (privateError) throw privateError;

      // If not a guest (viewing private claims), only fetch shared claims where user is the HOST/owner
      // Do not include shared claims where user is just a guest
      let sharedClaims: any[] = [];
      if (!isGuest) {
        const { data: sharedData, error: sharedError } = await supabase
          .from('claim_shares')
          .select(`
            claim_id,
            claims:claim_id (
              case_number,
              title,
              court,
              status
            )
          `)
          .eq('owner_id', user.id); // Only get claims where user is the owner/host

        if (!sharedError && sharedData) {
          sharedClaims = sharedData
            .map((share: any) => share.claims)
            .filter((claim: any) => claim && claim.status !== 'Closed')
            .map((claim: any) => ({
              case_number: claim.case_number,
              title: claim.title,
              court: claim.court,
              status: claim.status,
              isShared: true
            }));
        }
      }

      // Combine and deduplicate
      const allClaims = [
        ...(privateClaims || []).map(c => ({ ...c, isShared: false })),
        ...sharedClaims
      ];

      // Remove current claim from list
      const filtered = allClaims.filter(c => c.case_number !== currentClaimCaseNumber);

      setAvailableClaims(filtered as Claim[]);
    } catch (error: any) {
      console.error('Error fetching available claims:', error);
      toast({
        title: "Error",
        description: "Failed to load available claims",
        variant: "destructive",
      });
    } finally {
      setLoadingClaims(false);
    }
  };

  const handleShareSelected = async () => {
    if (!selectedTargetClaim || selectedEvidenceIds.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select evidence items and a target claim",
        variant: "destructive",
      });
      return;
    }

    setSharing(true);
    try {
      // Get the claim_id for the target claim
      const targetClaimId = await getClaimIdFromCaseNumber(selectedTargetClaim);
      if (!targetClaimId) {
        throw new Error("Could not find target claim");
      }

      // Link each selected evidence item to the target claim
      let successCount = 0;
      let errorCount = 0;

      for (const evidenceId of selectedEvidenceIds) {
        try {
          // Check if evidence is already linked to this claim
          const { data: existingLink } = await supabase
            .from('evidence_claims')
            .select('id')
            .eq('evidence_id', evidenceId)
            .eq('claim_id', targetClaimId)
            .maybeSingle();

          if (!existingLink) {
            await EvidenceService.linkEvidenceToClaim(evidenceId, targetClaimId);
            successCount++;
          } else {
            // Already linked, skip silently
            successCount++;
          }
        } catch (error: any) {
          console.error(`Error linking evidence ${evidenceId}:`, error);
          errorCount++;
        }
      }

      // If sharing to a shared claim (not a private claim), also link to each guest's private claim
      const targetClaim = availableClaims.find(c => c.case_number === selectedTargetClaim);
      if (targetClaim && (targetClaim as any).isShared && !isGuest) {
        // Get the claim_id for the shared claim
        const sharedClaimId = await getClaimIdFromCaseNumber(selectedTargetClaim);
        if (sharedClaimId) {
          // Get all guests who have access to this shared claim
          const { data: guests } = await supabase
            .from('claim_shares')
            .select('shared_with_id')
            .eq('claim_id', sharedClaimId);

          if (guests && guests.length > 0) {
            // For each guest, link evidence to their private claims
            for (const guestShare of guests) {
              const guestUserId = guestShare.shared_with_id;
              
              // Find the guest's private claims
              const { data: guestClaims } = await supabase
                .from('claims')
                .select('case_number')
                .eq('user_id', guestUserId)
                .neq('status', 'Closed')
                .limit(1);

              if (guestClaims && guestClaims.length > 0) {
                const guestClaimId = await getClaimIdFromCaseNumber(guestClaims[0].case_number);
                if (guestClaimId) {
                  // Link each evidence item to the guest's private claim
                  for (const evidenceId of selectedEvidenceIds) {
                    try {
                      const { data: existingLink } = await supabase
                        .from('evidence_claims')
                        .select('id')
                        .eq('evidence_id', evidenceId)
                        .eq('claim_id', guestClaimId)
                        .maybeSingle();

                      if (!existingLink) {
                        await EvidenceService.linkEvidenceToClaim(evidenceId, guestClaimId);
                      }
                    } catch (error) {
                      console.error(`Error linking to guest claim:`, error);
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (errorCount === 0) {
        toast({
          title: "Success",
          description: `Successfully shared ${successCount} evidence item(s) to the selected claim`,
          variant: "default",
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Partial Success",
          description: `Shared ${successCount} item(s), ${errorCount} failed`,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error('Error sharing evidence:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to share evidence",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Share Evidence to Another Claim</DialogTitle>
          <p className="text-sm text-gray-500 mt-2">
            Share {selectedEvidenceIds.length} selected evidence item(s) from "{currentClaimTitle}" to another claim. The same file will be shared between both claims.
          </p>
        </DialogHeader>
        
        {/* Target Claim Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Share to Claim:</label>
          {loadingClaims ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading available claims...
            </div>
          ) : (
            <Select value={selectedTargetClaim} onValueChange={setSelectedTargetClaim}>
              <SelectTrigger>
                <SelectValue placeholder="Select a claim to share evidence to" />
              </SelectTrigger>
              <SelectContent>
                {availableClaims.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">No claims available. Create a claim first.</div>
                ) : (
                  availableClaims.map(claim => (
                    <SelectItem key={claim.case_number} value={claim.case_number}>
                      {claim.case_number} - {claim.title}
                      {(claim as any).isShared && <span className="text-xs text-gray-400 ml-2">(Shared)</span>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sharing}>
            Cancel
          </Button>
          <Button 
            onClick={handleShareSelected}
            disabled={selectedEvidenceIds.length === 0 || !selectedTargetClaim || sharing}
          >
            {sharing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              `Share ${selectedEvidenceIds.length} Item(s)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
