
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Exhibit {
  id: string;
  name: string;
  exhibit_number: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useExhibits = () => {
  const [exhibits, setExhibits] = useState<Exhibit[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchExhibits = async () => {
    if (!user) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('exhibits')
      .select('*')
      .order('exhibit_number', { ascending: true });

    if (error) {
      console.error('Error fetching exhibits:', error);
      toast({
        title: "Error",
        description: "Failed to fetch exhibits",
        variant: "destructive",
      });
    } else {
      setExhibits(data || []);
    }
    setLoading(false);
  };

  const addExhibit = async (exhibitData: Omit<Exhibit, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('exhibits')
      .insert([{ ...exhibitData, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error adding exhibit:', error);
      toast({
        title: "Error",
        description: "Failed to create exhibit",
        variant: "destructive",
      });
      return null;
    } else {
      setExhibits(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Exhibit created successfully",
      });
      return data;
    }
  };

  const updateExhibit = async (exhibitId: string, updates: Partial<Omit<Exhibit, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('exhibits')
      .update(updates)
      .eq('id', exhibitId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating exhibit:', error);
      toast({
        title: "Error",
        description: "Failed to update exhibit",
        variant: "destructive",
      });
      return null;
    } else {
      setExhibits(prev => prev.map(exhibit => 
        exhibit.id === exhibitId ? data : exhibit
      ));
      toast({
        title: "Success",
        description: "Exhibit updated successfully",
      });
      return data;
    }
  };

  const getNextExhibitNumber = () => {
    if (exhibits.length === 0) return 1;
    return Math.max(...exhibits.map(e => e.exhibit_number)) + 1;
  };

  useEffect(() => {
    if (user) {
      fetchExhibits();
    }
  }, [user]);

  return {
    exhibits,
    loading,
    addExhibit,
    updateExhibit,
    getNextExhibitNumber,
    refetch: fetchExhibits,
  };
};
