import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SharePermissions } from '@/types/collaboration';
import { Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (email: string, permissions: SharePermissions) => Promise<boolean>;
  onSearchUsers: (query: string) => Promise<any[]>;
}

export const ShareClaimModal = ({ open, onOpenChange, onShare, onSearchUsers }: Props) => {
  const [email, setEmail] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [permissions, setPermissions] = useState<SharePermissions>({
    can_view_evidence: true,
  });

  const handleSearch = async (query: string) => {
    setEmail(query);
    if (query.length > 2) {
      setSearching(true);
      try {
        const results = await onSearchUsers(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectUser = (userEmail: string) => {
    setEmail(userEmail);
    setSearchResults([]);
  };

  const handleShare = async () => {
    if (!email) return;
    
    setSharing(true);
    const success = await onShare(email, permissions);
    setSharing(false);
    
    if (success) {
      setEmail('');
      setPermissions({
        can_view_evidence: true,
      });
      onOpenChange(false);
    }
  };

  const updatePermission = (key: keyof SharePermissions, value: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="share-claim-description">
        <DialogHeader>
          <DialogTitle>Share Claim</DialogTitle>
          <DialogDescription id="share-claim-description">
            Share this claim with another user by entering their email address. They will be able to view and submit evidence based on the permissions you set.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">User Email</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter user email..."
                value={email}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
                    onClick={() => handleSelectUser(user.email)}
                  >
                    <div className="font-medium">{user.full_name || user.email}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                ))}
              </div>
            )}
            
            {searching && (
              <div className="text-sm text-muted-foreground">Searching...</div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Permissions</Label>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="view-evidence"
                  checked={permissions.can_view_evidence}
                  onCheckedChange={(checked) => updatePermission('can_view_evidence', !!checked)}
                />
                <Label htmlFor="view-evidence" className="text-sm font-normal">
                  Can view evidence and submit new evidence for approval
                </Label>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Note: Shared users can only view existing evidence and submit new evidence for your approval. They cannot edit or delete existing claim data.
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleShare} 
              disabled={!email || sharing}
            >
              {sharing ? 'Sharing...' : 'Share'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};