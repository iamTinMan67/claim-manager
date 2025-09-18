import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollaboration } from '@/hooks/useCollaboration';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';
import { Share2, Eye, Edit, Clock, FileText, Users } from 'lucide-react';

interface Props {
  onSelectClaim?: (claimId: string) => void;
}

export const SharedClaimsList = ({ onSelectClaim }: Props) => {
  const { sharedWithMe, fetchSharedWithMe } = useCollaboration();

  useEffect(() => {
    fetchSharedWithMe();
  }, []);

  const getPermissionIcons = (share: any) => {
    const icons = [];
    if (share.can_view_evidence || share.can_edit_evidence) {
      icons.push({ icon: FileText, label: 'Evidence', canEdit: share.can_edit_evidence });
    }
    if (share.can_view_todos || share.can_edit_todos) {
      icons.push({ icon: Clock, label: 'Todos', canEdit: share.can_edit_todos });
    }
    if (share.can_view_notes || share.can_edit_notes) {
      icons.push({ icon: Users, label: 'Notes', canEdit: share.can_edit_notes });
    }
    return icons;
  };

  if (sharedWithMe.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Share2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Shared Claims</h3>
            <p className="text-muted-foreground">
              No claims have been shared with you yet. When someone shares a claim with you, it will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Premium Subscription Upgrade Option */}
      <div className="mb-6">
        <SubscriptionStatus />
      </div>
      
      <h2 className="text-xl font-semibold mb-4">Claims Shared With Me</h2>
      {sharedWithMe.map((share) => {
        const permissionIcons = getPermissionIcons(share);
        
        return (
          <Card key={share.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {share.claim?.title || 'Unknown Claim'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Case: {share.claim?.case_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Shared by: {share.owner?.full_name || share.owner?.email}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={share.claim?.status === 'Active' ? 'default' : 'secondary'}>
                    {share.claim?.status}
                  </Badge>
                  {onSelectClaim && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectClaim(share.claim_id)}
                    >
                      View Claim
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">Your Permissions:</h4>
                  <div className="flex flex-wrap gap-2">
                    {permissionIcons.map((perm, idx) => (
                      <div key={idx} className="flex items-center space-x-1">
                        <perm.icon className="w-4 h-4" />
                        <span className="text-sm">{perm.label}</span>
                        {perm.canEdit ? (
                          <Edit className="w-3 h-3 text-green-600" />
                        ) : (
                          <Eye className="w-3 h-3 text-blue-600" />
                        )}
                      </div>
                    ))}
                    {permissionIcons.length === 0 && (
                      <Badge variant="outline" className="text-xs">
                        View only (basic claim info)
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shared on {new Date(share.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};