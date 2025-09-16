import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShareClaimModal } from './ShareClaimModal';
import { useCollaboration } from '@/hooks/useCollaboration';
import { ClaimShare, SharePermissions } from '@/types/collaboration';
import { Share2, UserX, Settings, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Props {
  claimId: string;
}

export const ClaimSharingTab = ({ claimId }: Props) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToRemove, setShareToRemove] = useState<string | null>(null);
  const [donationInfo, setDonationInfo] = useState<{ shareId: string; userEmail: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const {
    shares,
    loading,
    permissions,
    shareClaimWithUser,
    updateSharePermissions,
    removeShare,
    searchUsers,
    createDonationPayment,
  } = useCollaboration(claimId);

  const getPermissionBadges = (share: ClaimShare) => {
    const badges = [];
    if (share.can_view_evidence) badges.push('Can View & Submit Evidence');
    return badges;
  };

  const getDonationBadge = (share: ClaimShare) => {
    if (!share.donation_required) {
      return <Badge variant="secondary" className="text-xs">Free Collaborator</Badge>;
    }
    if (share.donation_paid) {
      return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Donation Paid</Badge>;
    }
    return <Badge variant="destructive" className="text-xs">Donation Required</Badge>;
  };

  const handleShareClaim = async (userEmail: string, sharePermissions: SharePermissions) => {
    const result = await shareClaimWithUser(userEmail, sharePermissions);
    
    if (result && typeof result === 'object' && result.success) {
      if (result.requiresDonation && result.shareId) {
        // Show donation modal
        setDonationInfo({ shareId: result.shareId, userEmail });
        setShowShareModal(false);
        return true;
      }
      setShowShareModal(false);
      return true;
    }
    return false;
  };

  const handleDonationPayment = async () => {
    if (!donationInfo) return;
    
    setProcessing(true);
    try {
      const paymentUrl = await createDonationPayment(donationInfo.shareId);
      if (paymentUrl) {
        // Open payment in new tab
        window.open(paymentUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to create donation payment:', error);
    } finally {
      setProcessing(false);
      setDonationInfo(null);
    }
  };

  const handleRemoveShare = async () => {
    if (shareToRemove) {
      await removeShare(shareToRemove);
      setShareToRemove(null);
    }
  };

  const freeSharesCount = shares.filter(share => !share.donation_required).length;
  const paidSharesCount = shares.filter(share => share.donation_required && share.donation_paid).length;
  const unpaidSharesCount = shares.filter(share => share.donation_required && !share.donation_paid).length;

  if (!permissions.canEdit) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have permission to manage sharing for this claim.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Claim Sharing</h3>
        <Button onClick={() => setShowShareModal(true)}>
          <Share2 className="w-4 h-4 mr-2" />
          Share Claim
        </Button>
      </div>

      {/* Sharing Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{freeSharesCount}</div>
              <div className="text-sm text-muted-foreground">Free Collaborators</div>
              <div className="text-xs text-muted-foreground">(2 max)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{paidSharesCount}</div>
              <div className="text-sm text-muted-foreground">Paid Collaborators</div>
              <div className="text-xs text-muted-foreground">(£5 each)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{unpaidSharesCount}</div>
              <div className="text-sm text-muted-foreground">Pending Payment</div>
              <div className="text-xs text-muted-foreground">(requires donation)</div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            You can share with up to 2 collaborators for free. Additional collaborators require a £5 donation each.
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8">
          <p>Loading sharing information...</p>
        </div>
      ) : shares.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Share2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">This claim is not shared with anyone yet.</p>
              <Button onClick={() => setShowShareModal(true)}>
                Share with someone
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {shares.map((share) => (
            <Card key={share.id} className={share.donation_required && !share.donation_paid ? 'border-orange-200 bg-orange-50' : ''}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">
                      {share.shared_with?.full_name || share.shared_with?.email || 'Unknown User'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {share.shared_with?.email}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {share.donation_required && !share.donation_paid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDonationInfo({ shareId: share.id, userEmail: share.shared_with?.email })}
                        className="border-orange-200 text-orange-700 hover:bg-orange-100"
                      >
                        <CreditCard className="w-4 h-4 mr-1" />
                        Pay £5
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: Implement edit permissions modal
                        console.log('Edit permissions for', share.id);
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShareToRemove(share.id)}
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-2">
                  {getPermissionBadges(share).map((badge) => (
                    <Badge key={badge} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                  {getPermissionBadges(share).length === 0 && (
                    <Badge variant="outline" className="text-xs">
                      No permissions
                    </Badge>
                  )}
                  {getDonationBadge(share)}
                </div>
                {share.donation_required && !share.donation_paid && (
                  <div className="flex items-center gap-2 p-2 bg-orange-100 rounded-md mb-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-orange-700">
                      Donation required to activate this collaboration
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Shared on {new Date(share.created_at).toLocaleDateString()}
                  {share.donation_paid_at && (
                    <span> • Donation paid on {new Date(share.donation_paid_at).toLocaleDateString()}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ShareClaimModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        onShare={handleShareClaim}
        onSearchUsers={searchUsers}
      />

      {/* Donation Modal */}
      <Dialog open={!!donationInfo} onOpenChange={() => setDonationInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collaboration Donation Required</DialogTitle>
            <DialogDescription>
              You've already shared this claim with 2 free collaborators. To add {donationInfo?.userEmail} as an additional collaborator, a £5 donation is required.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Donation: £5.00</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This donation helps support the platform and allows unlimited collaboration for this additional user.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDonationInfo(null)}>
              Cancel
            </Button>
            <Button onClick={handleDonationPayment} disabled={processing}>
              {processing ? "Processing..." : "Pay £5 Donation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!shareToRemove} onOpenChange={() => setShareToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Share</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user's access to the claim? 
              They will no longer be able to view or edit any part of this claim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveShare}>
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};