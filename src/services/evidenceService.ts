import { supabase } from '@/integrations/supabase/client';
import { Evidence } from '@/types/evidence';
import { retryWithReauth } from '@/utils/authUtils';
import { TodoItem } from '@/types/todo';

export class EvidenceService {
  static async fetchEvidence(): Promise<Evidence[]> {
    const operation = async () => {
      // Fetch evidence and evidence_claims separately since the relationship needs to be rebuilt
      const { data: evidenceData, error: evidenceError } = await supabase
        .from('evidence')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (evidenceError) throw evidenceError;

      // Fetch evidence_claims separately
      const { data: evidenceClaimsData, error: claimsError } = await supabase
        .from('evidence_claims')
        .select('evidence_id, claim_id');

      if (claimsError) throw claimsError;

      // Create a map of evidence_id to claim_ids
      const evidenceClaimsMap = new Map<string, string[]>();
      evidenceClaimsData?.forEach(ec => {
        if (!evidenceClaimsMap.has(ec.evidence_id)) {
          evidenceClaimsMap.set(ec.evidence_id, []);
        }
        evidenceClaimsMap.get(ec.evidence_id)?.push(ec.claim_id);
      });

      const mappedEvidence: Evidence[] = evidenceData?.map(item => ({
        id: item.id,
        file_name: item.file_name,
        file_url: item.file_url,
        exhibit_number: (item as any).exhibit_number, // Primary field for exhibit numbers
        number_of_pages: item.number_of_pages,
        date_submitted: item.date_submitted,
        method: item.method,
        url_link: item.url_link,
        book_of_deeds_ref: item.book_of_deeds_ref,
        display_order: item.display_order,
        created_at: item.created_at,
        updated_at: item.updated_at,
        claimIds: evidenceClaimsMap.get(item.id) || []
      })) || [];

      return mappedEvidence;
    };

    return await retryWithReauth(operation);
  }

  static async createEvidence(
    evidenceData: Omit<Evidence, 'id' | 'created_at' | 'updated_at' | 'claimIds' | 'display_order'>,
    userId: string
  ): Promise<any> {
    const operation = async () => {
      // Get the minimum display_order value for this user
      // Since list is sorted descending, new items should have the lowest display_order to appear at the end
      const { data: minOrderData } = await supabase
        .from('evidence')
        .select('display_order')
        .eq('user_id', userId)
        .not('display_order', 'is', null)
        .order('display_order', { ascending: true })
        .limit(1);
      
      const minOrder = minOrderData?.[0]?.display_order ?? 1;
      const nextOrder = Math.max(0, minOrder - 1);

      const { data, error } = await supabase
        .from('evidence')
        .insert([{ 
          file_name: evidenceData.file_name,
          file_url: evidenceData.file_url,
          exhibit_number: evidenceData.exhibit_number,
          number_of_pages: evidenceData.number_of_pages,
          date_submitted: evidenceData.date_submitted,
          method: evidenceData.method,
          url_link: evidenceData.url_link,
          book_of_deeds_ref: evidenceData.book_of_deeds_ref,
          display_order: nextOrder,
          user_id: userId 
        }])
        .select()
        .single();

      if (error) {
        console.error('Evidence insert error:', error);
        throw error;
      }

      // Only create todo when date_submitted is provided with "To-Do" method
      if (evidenceData.method === 'To-Do' && evidenceData.date_submitted) {
        await this.createTodoFromEvidence(data, evidenceData.date_submitted, userId);
      }

      console.log('Evidence created successfully:', data);
      return data;
    };

    return await retryWithReauth(operation);
  }

  static async updateEvidence(id: string, updates: Partial<Evidence>): Promise<void> {
    const operation = async () => {
      const updateData: any = {
        number_of_pages: updates.number_of_pages,
        date_submitted: updates.date_submitted,
        method: updates.method,
        url_link: updates.url_link,
        book_of_deeds_ref: updates.book_of_deeds_ref,
        file_name: updates.file_name,
        file_url: updates.file_url,
        display_order: updates.display_order,
      };
      
      // Only include exhibit_number if it's being updated
      if (updates.exhibit_number !== undefined) {
        updateData.exhibit_number = updates.exhibit_number;
      }
      
      const { error } = await supabase
        .from('evidence')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Evidence update error:', error);
        throw error;
      }

      // Handle todo creation/update based on date_submitted changes
      if (updates.date_submitted && updates.method === 'To-Do') {
        await this.createOrUpdateTodoFromEvidence(id, updates.date_submitted);
      } else if (updates.method && updates.method !== 'To-Do') {
        await this.deleteTodoFromEvidence(id);
      }

      console.log('Evidence updated successfully');
    };

    await retryWithReauth(operation);
  }

  static async deleteStoredFile(fileUrl: string): Promise<void> {
    if (!fileUrl || !fileUrl.includes('evidence-files')) return;

    try {
      // Extract the file path from the URL
      const urlParts = fileUrl.split('/evidence-files/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        
        const { error } = await supabase.storage
          .from('evidence-files')
          .remove([filePath]);

        if (error) {
          console.error('Error deleting file from storage:', error);
          // Don't throw error - we still want to update the database even if file deletion fails
        } else {
          console.log('File deleted from storage successfully');
        }
      }
    } catch (error) {
      console.error('Error parsing file URL for deletion:', error);
    }
  }

  static async updateEvidenceFile(evidenceId: string, newFileUrl: string | null, newFileName: string | null, oldFileUrl: string | null): Promise<void> {
    const operation = async () => {
      // Delete old file if it exists and we're replacing it
      if (oldFileUrl && newFileUrl) {
        await this.deleteStoredFile(oldFileUrl);
      }

      // Update evidence record with new file info
      const { error } = await supabase
        .from('evidence')
        .update({
          file_name: newFileName,
          file_url: newFileUrl,
        })
        .eq('id', evidenceId);

      if (error) {
        console.error('Evidence file update error:', error);
        throw error;
      }

      console.log('Evidence file updated successfully');
    };

    await retryWithReauth(operation);
  }

  static async linkEvidenceToClaims(evidenceId: string, claimIds: string[]): Promise<void> {
    if (claimIds.length === 0) return;

    const operation = async () => {
      const linkData = claimIds.map(claimId => ({
        evidence_id: evidenceId,
        claim_id: claimId
      }));

      console.log('Linking evidence to claims:', linkData);

      const { error: linkError } = await supabase
        .from('evidence_claims')
        .insert(linkData);

      if (linkError) {
        console.error('Evidence linking error:', linkError);
        throw linkError;
      }

      console.log('Evidence linked to claims successfully');
    };

    await retryWithReauth(operation);
  }

  static async deleteEvidence(id: string): Promise<void> {
    const operation = async () => {
      // First get the evidence to check if it has a file
      const { data: evidence, error: fetchError } = await supabase
        .from('evidence')
        .select('file_url')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching evidence for deletion:', fetchError);
      }

      // Delete the file from storage if it exists
      if (evidence?.file_url) {
        await this.deleteStoredFile(evidence.file_url);
      }

      // Delete associated todo if it exists
      await this.deleteTodoFromEvidence(id);

      // Delete the evidence record
      const { error } = await supabase
        .from('evidence')
        .delete()
        .eq('id', id);

      if (error) throw error;
    };

    await retryWithReauth(operation);
  }

  static async linkEvidenceToClaim(evidenceId: string, claimId: string): Promise<void> {
    const operation = async () => {
      const { error } = await supabase
        .from('evidence_claims')
        .insert([{ evidence_id: evidenceId, claim_id: claimId }]);

      if (error) throw error;
    };

    await retryWithReauth(operation);
  }

  static async unlinkEvidenceFromClaim(evidenceId: string, claimId: string): Promise<void> {
    const operation = async () => {
      const { error } = await supabase
        .from('evidence_claims')
        .delete()
        .eq('evidence_id', evidenceId)
        .eq('claim_id', claimId);

      if (error) throw error;
    };

    await retryWithReauth(operation);
  }

  static async reorderEvidence(evidenceList: Evidence[]): Promise<void> {
    const operation = async () => {
      // Update display_order and exhibit_number for each evidence item
      // The list is assumed to be in the desired visual order (first item = exhibit 1, etc.)
      // display_order: descending (highest first, since list is sorted descending)
      // exhibit_number: ascending (1, 2, 3... based on position in list)
      const updates = evidenceList.map((evidence, index) => {
        return supabase
          .from('evidence')
          .update({ 
            display_order: evidenceList.length - index, // Descending: first item gets highest display_order
            exhibit_number: index + 1 // Ascending: first item gets exhibit 1
          })
          .eq('id', evidence.id);
      });

      // Execute all updates in parallel
      const results = await Promise.all(updates);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('Reorder errors:', errors);
        throw new Error('Failed to reorder some evidence items');
      }

      console.log('Evidence reordered successfully');
    };

    await retryWithReauth(operation);
  }

  private static async createTodoFromEvidence(evidenceData: any, dateSubmitted: string, userId: string): Promise<void> {
    try {
      const dueDate = new Date(dateSubmitted);
      // Set due time to 9 AM if no time specified
      if (dueDate.getHours() === 0 && dueDate.getMinutes() === 0) {
        dueDate.setHours(9, 0, 0, 0);
      }

      const { error } = await supabase
        .from('todos')
        .insert([{
          title: evidenceData.file_name || 'Evidence Item',
          description: `Evidence item: ${evidenceData.file_name || 'Evidence Item'}`,
          due_date: dueDate.toISOString(),
          priority: 'medium',
          alarm_enabled: true,
          alarm_time: dueDate.toISOString(),
          user_id: userId,
          evidence_id: evidenceData.id,
          completed: false
        }]);

      if (error) {
        console.error('Error creating todo from evidence:', error);
      } else {
        console.log('Todo created from evidence successfully');
      }
    } catch (error) {
      console.error('Error in createTodoFromEvidence:', error);
    }
  }

  private static async createOrUpdateTodoFromEvidence(evidenceId: string, dateSubmitted: string): Promise<void> {
    try {
      // First, get the evidence details
      const { data: evidence, error: evidenceError } = await supabase
        .from('evidence')
        .select('file_name')
        .eq('id', evidenceId)
        .single();

      if (evidenceError || !evidence) {
        console.error('Error fetching evidence for todo update:', evidenceError);
        return;
      }

      const dueDate = new Date(dateSubmitted);
      // Set due time to 9 AM if no time specified
      if (dueDate.getHours() === 0 && dueDate.getMinutes() === 0) {
        dueDate.setHours(9, 0, 0, 0);
      }

      // Check if todo already exists for this evidence
      const { data: existingTodo, error: todoError } = await supabase
        .from('todos')
        .select('id')
        .eq('evidence_id', evidenceId)
        .single();

      if (existingTodo) {
        // Update existing todo
        const { error: updateError } = await supabase
          .from('todos')
          .update({
            title: evidence.file_name || 'Evidence Item',
            due_date: dueDate.toISOString(),
            alarm_time: dueDate.toISOString(),
          })
          .eq('id', existingTodo.id);

        if (updateError) {
          console.error('Error updating todo from evidence:', updateError);
        }
      } else {
        // Create new todo
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await this.createTodoFromEvidence(evidence, dateSubmitted, userData.user.id);
        }
      }
    } catch (error) {
      console.error('Error in createOrUpdateTodoFromEvidence:', error);
    }
  }

  private static async deleteTodoFromEvidence(evidenceId: string): Promise<void> {
    try {
      // Delete todo directly by evidence_id
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('evidence_id', evidenceId);


      if (error) {
        console.error('Error deleting todo from evidence:', error);
      }
    } catch (error) {
      console.error('Error in deleteTodoFromEvidence:', error);
    }
  }
}
