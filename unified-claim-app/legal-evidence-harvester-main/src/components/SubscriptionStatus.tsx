import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2, Crown, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const SubscriptionStatus = () => {
  const { user } = useAuth();
  const { 
    subscribed, 
    subscription_tier, 
    subscription_end, 
    loading, 
    checkSubscription, 
    createCheckout, 
    manageSubscription 
  } = useSubscription();

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Premium Subscription
          </CardTitle>
          <CardDescription>
            Please log in to view subscription status
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading subscription status...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={subscribed ? "border-primary bg-primary/5" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className={`h-5 w-5 ${subscribed ? 'text-primary' : 'text-muted-foreground'}`} />
          Premium Subscription
          {subscribed && <Badge variant="secondary">Active</Badge>}
        </CardTitle>
        <CardDescription>
          {subscribed 
            ? `You have an active ${subscription_tier || 'Premium'} subscription`
            : 'Upgrade to Premium for advanced collaboration features'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscribed ? (
          <div className="space-y-3">
            <div className="text-sm">
              <strong>Plan:</strong> {subscription_tier || 'Premium'}
            </div>
            {subscription_end && (
              <div className="text-sm">
                <strong>Next billing:</strong> {new Date(subscription_end).toLocaleDateString()}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={manageSubscription} variant="outline">
                Manage Subscription
              </Button>
              <Button 
                onClick={checkSubscription} 
                variant="ghost" 
                size="sm"
                className="px-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Get access to:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Advanced collaboration features</li>
                <li>Priority support</li>
                <li>Enhanced storage</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={createCheckout} className="flex-1">
                Subscribe Now - $7.99/month
              </Button>
              <Button 
                onClick={checkSubscription} 
                variant="ghost" 
                size="sm"
                className="px-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};