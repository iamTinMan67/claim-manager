import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowLeft, Users } from 'lucide-react';
import { useCollaboration } from '@/hooks/useCollaboration';
import { supabase } from '@/integrations/supabase/client';

export const DonationPayment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [claimDetails, setClaimDetails] = useState<any>(null);
  const { createDonationPayment } = useCollaboration();
  
  const claimId = searchParams.get('claimId');
  const amount = searchParams.get('amount');

  useEffect(() => {
    const fetchClaimDetails = async () => {
      if (!claimId) return;

      try {
        const { data, error } = await supabase
          .from('claims')
          .select('title, case_number')
          .eq('case_number', claimId)
          .maybeSingle();

        if (!error && data) {
          setClaimDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch claim details:', error);
      }
    };

    fetchClaimDetails();
  }, [claimId]);

  const handlePayment = async () => {
    if (!claimId || !amount) {
      console.error('Missing required parameters');
      return;
    }

    setLoading(true);
    try {
      // Create a temporary share to get donation payment
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Create temporary share for payment processing
      const { data: tempShare, error: shareError } = await supabase
        .from('claim_shares')
        .insert({
          claim_id: claimId,
          owner_id: user.id,
          shared_with_id: user.id, // Temporary self-share
          permission: 'view',
          can_view_evidence: false,
          donation_required: true,
          donation_paid: false,
          donation_amount: parseInt(amount)
        })
        .select()
        .single();

      if (shareError) {
        throw new Error('Failed to create payment request');
      }

      // Create payment session
      const { data, error } = await supabase.functions.invoke('create-donation-payment', {
        body: { 
          claimId, 
          shareId: tempShare.id,
          customAmount: parseInt(amount)
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Redirect to Stripe
      window.location.href = data.url;
    } catch (error) {
      console.error('Payment creation failed:', error);
      alert('Failed to create payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!claimId || !amount) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive">Invalid payment request. Missing required parameters.</p>
              <Button onClick={() => navigate('/')} className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const donationAmount = parseInt(amount) / 100;
  const isHigherTier = donationAmount >= 70;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <CardTitle className="text-xl">
              Collaborator Limit Donation
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {claimDetails && (
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold text-sm">Claim Details:</h3>
              <p className="text-sm text-muted-foreground">{claimDetails.title}</p>
              <p className="text-sm text-muted-foreground">Case: {claimDetails.case_number}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">£{donationAmount}</div>
              <p className="text-sm text-muted-foreground">One-time donation required</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">
                {isHigherTier ? 'Large Collaboration Support' : 'Extended Collaboration Support'}
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Support for {isHigherTier ? '100+' : '50+'} collaborators</li>
                <li>• Enhanced infrastructure costs</li>
                <li>• Premium collaboration features</li>
                <li>• Priority support</li>
              </ul>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                This donation helps cover the additional infrastructure and support costs 
                required for large-scale collaboration on your claim.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handlePayment} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {loading ? 'Creating Payment...' : `Pay £${donationAmount}`}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};