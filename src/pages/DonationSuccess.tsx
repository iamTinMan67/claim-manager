import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useCollaboration } from '@/hooks/useCollaboration';

export const DonationSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const { verifyDonationPayment } = useCollaboration();
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setVerifying(false);
        return;
      }

      try {
        const success = await verifyDonationPayment(sessionId);
        setVerified(success);
      } catch (error) {
        console.error('Failed to verify payment:', error);
        setVerified(false);
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [sessionId, verifyDonationPayment]);

  if (verifying) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Verifying your donation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <CardTitle className="text-xl">
              {verified ? 'Donation Successful!' : 'Payment Processing'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {verified ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Thank you for your £5 donation! The collaboration has been activated successfully.
              </p>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-700">
                  ✓ Collaboration activated<br />
                  ✓ User can now access the claim<br />
                  ✓ Evidence sharing enabled
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Your payment is being processed. The collaboration will be activated once payment is confirmed.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  Payment confirmation may take a few minutes. You'll receive an email notification once complete.
                </p>
              </div>
            </div>
          )}
          
          <div className="mt-6">
            <Button onClick={() => navigate('/')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};