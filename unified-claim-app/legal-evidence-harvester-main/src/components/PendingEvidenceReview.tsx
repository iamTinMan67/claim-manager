import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PendingEvidence } from '@/types/pendingEvidence';
import { PendingEvidenceService } from '@/services/pendingEvidenceService';
import { CheckCircle, XCircle, Clock, FileText, ExternalLink, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  pendingEvidence: PendingEvidence[];
  onRefresh: () => void;
  isOwner: boolean;
}

export const PendingEvidenceReview: React.FC<Props> = ({
  pendingEvidence,
  onRefresh,
  isOwner,
}) => {
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleReview = async () => {
    if (!reviewingId) return;

    setLoading(true);
    try {
      if (reviewAction === 'approve') {
        await PendingEvidenceService.approvePendingEvidence(reviewingId, reviewNotes);
        toast({
          title: 'Evidence Approved',
          description: 'The evidence has been approved and added to the claim.',
        });
      } else {
        if (!reviewNotes.trim()) {
          toast({
            title: 'Review Notes Required',
            description: 'Please provide notes explaining why this evidence was rejected.',
            variant: 'destructive',
          });
          return;
        }
        await PendingEvidenceService.rejectPendingEvidence(reviewingId, reviewNotes);
        toast({
          title: 'Evidence Rejected',
          description: 'The evidence has been rejected.',
        });
      }
      
      setReviewingId(null);
      setReviewNotes('');
      onRefresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process the review. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openReviewDialog = (id: string, action: 'approve' | 'reject') => {
    setReviewingId(id);
    setReviewAction(action);
    setReviewNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (pendingEvidence.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isOwner ? 'No pending evidence submissions.' : 'You have not submitted any evidence for review.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pendingEvidence.map((evidence) => (
        <Card key={evidence.id}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-base">{evidence.file_name || 'Evidence Item'}</CardTitle>
                {evidence.submitter && (
                  <p className="text-sm text-muted-foreground">
                    Submitted by {evidence.submitter.full_name || evidence.submitter.email}
                  </p>
                )}
              </div>
              {getStatusBadge(evidence.status)}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {evidence.exhibit_id && (
                <div>
                  <span className="font-medium">Exhibit:</span> {evidence.exhibit_id}
                </div>
              )}
              {evidence.method && (
                <div>
                  <span className="font-medium">Method:</span> {evidence.method}
                </div>
              )}
              {evidence.number_of_pages && (
                <div>
                  <span className="font-medium">Pages:</span> {evidence.number_of_pages}
                </div>
              )}
              {evidence.date_submitted && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(evidence.date_submitted).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {evidence.file_url && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(evidence.file_url, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View File
                </Button>
              </div>
            )}

            {evidence.url_link && (
              <div>
                <span className="font-medium text-sm">URL:</span>
                <a 
                  href={evidence.url_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline ml-2 text-sm"
                >
                  {evidence.url_link}
                </a>
              </div>
            )}

            {evidence.book_of_deeds_ref && (
              <div>
                <span className="font-medium text-sm">Book of Deeds:</span> {evidence.book_of_deeds_ref}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Submitted on {new Date(evidence.submitted_at).toLocaleString()}
            </div>

            {evidence.reviewer_notes && (
              <div className="bg-muted p-3 rounded text-sm">
                <span className="font-medium">Review Notes:</span>
                <p className="mt-1">{evidence.reviewer_notes}</p>
              </div>
            )}

            {isOwner && evidence.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => openReviewDialog(evidence.id, 'approve')}
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReviewDialog(evidence.id, 'reject')}
                  className="flex items-center gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!reviewingId} onOpenChange={() => setReviewingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Evidence' : 'Reject Evidence'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="review-notes">
                {reviewAction === 'approve' ? 'Review Notes (Optional)' : 'Rejection Reason (Required)'}
              </Label>
              <Textarea
                id="review-notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  reviewAction === 'approve' 
                    ? 'Optional notes about this approval...'
                    : 'Please explain why this evidence is being rejected...'
                }
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewingId(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={loading || (reviewAction === 'reject' && !reviewNotes.trim())}
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
            >
              {loading ? 'Processing...' : (reviewAction === 'approve' ? 'Approve' : 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};