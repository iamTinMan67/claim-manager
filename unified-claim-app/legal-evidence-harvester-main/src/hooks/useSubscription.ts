import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string | null;
  subscription_end?: string | null;
}

export const useSubscription = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    subscribed: false,
    subscription_tier: null,
    subscription_end: null,
  });
  const [loading, setLoading] = useState(true);
  const { user, session } = useAuth();

  const checkSubscription = async () => {
    if (!user || !session) {
      setSubscriptionData({ subscribed: false, subscription_tier: null, subscription_end: null });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSubscriptionData({
        subscribed: data.subscribed || false,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      // Silently fail - set to unsubscribed state without showing error toast
      setSubscriptionData({ subscribed: false, subscription_tier: null, subscription_end: null });
    } finally {
      setLoading(false);
    }
  };

  const createCheckout = async () => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to create checkout session",
        variant: "destructive",
      });
    }
  };

  const manageSubscription = async () => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please log in to manage subscription",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Open customer portal in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Error",
        description: "Failed to open customer portal",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user, session]);

  // Auto-refresh subscription status every 10 seconds when on the page
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkSubscription();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user, session]);

  return {
    ...subscriptionData,
    loading,
    checkSubscription,
    createCheckout,
    manageSubscription,
  };
};