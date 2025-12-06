import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isAuthError } from '@/utils/authUtils';
import { Claim, ClaimInput } from '@/types/claim';

export type { Claim } from '@/types/claim';

export const useClaims = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchClaims = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map database results to frontend Claim type
      const mappedClaims: Claim[] = (data || []).map((item: any) => ({
        case_number: item.case_number,
        title: item.title,
        court: item.court,
        plaintiff_name: item.plaintiff_name,
        defendant_name: item.defendant_name,
        email: item.email,
        description: item.description,
        status: item.status as 'Active' | 'Pending' | 'Closed',
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      setClaims(mappedClaims);
    } catch (error) {
      console.error('Error fetching claims:', error);
      
      if (isAuthError(error)) {
        toast.error("Authentication Error: Please refresh your session or log in again");
      } else {
        toast.error("Failed to fetch claims");
      }
    } finally {
      setLoading(false);
    }
  };

  const addClaim = async (claimData: ClaimInput) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('claims')
        .insert([{ ...claimData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      const mappedClaim: Claim = {
        case_number: data.case_number,
        title: data.title,
        court: data.court,
        plaintiff_name: data.plaintiff_name,
        defendant_name: data.defendant_name,
        email: data.email,
        description: data.description,
        status: data.status as 'Active' | 'Pending' | 'Closed',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      setClaims(prev => [mappedClaim, ...prev]);
      toast.success("Claim created successfully");
      return mappedClaim;
    } catch (error) {
      console.error('Error adding claim:', error);
      
      if (isAuthError(error)) {
        toast.error("Authentication Error: Please refresh your session or log in again");
      } else {
        toast.error("Failed to create claim");
      }
      return null;
    }
  };

  const updateClaim = async (caseNumber: string, updates: Partial<Claim>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('claims')
        .update(updates)
        .eq('case_number', caseNumber)
        .select()
        .single();

      if (error) throw error;
      
      const mappedClaim: Claim = {
        case_number: data.case_number,
        title: data.title,
        court: data.court,
        plaintiff_name: data.plaintiff_name,
        defendant_name: data.defendant_name,
        email: data.email,
        description: data.description,
        status: data.status as 'Active' | 'Pending' | 'Closed',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      setClaims(prev => prev.map(claim => claim.case_number === caseNumber ? mappedClaim : claim));
      toast.success("Claim updated successfully");
    } catch (error) {
      console.error('Error updating claim:', error);
      
      if (isAuthError(error)) {
        toast.error("Authentication Error: Please refresh your session or log in again");
      } else {
        toast.error("Failed to update claim");
      }
    }
  };

  const deleteClaim = async (caseNumber: string) => {
    if (!user) return;

    try {
      // Cast supabase to any to bypass TypeScript recursion issue
      const client = supabase as any;
      
      // Delete evidence links first
      await client
        .from('evidence_claims')
        .delete()
        .eq('case_number', caseNumber);
      
      // Delete the claim
      await client
        .from('claims')
        .delete()
        .eq('case_number', caseNumber);
      
      // Update local state
      setClaims(currentClaims => currentClaims.filter(claim => claim.case_number !== caseNumber));
      toast.success("Claim deleted successfully");
    } catch (error: unknown) {
      console.error('Error deleting claim:', error);
      
      if (isAuthError(error)) {
        toast.error("Authentication Error: Please refresh your session or log in again");
      } else {
        toast.error("Failed to delete claim");
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchClaims();
    }
  }, [user]);

  return {
    claims,
    loading,
    addClaim,
    updateClaim,
    deleteClaim,
    refetch: fetchClaims,
  };
};