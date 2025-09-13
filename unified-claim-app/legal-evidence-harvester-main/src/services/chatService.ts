import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';

export class ChatService {
  static async getMessages(claimId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // Fetch sender details separately
    const messagesWithSenders = await Promise.all(
      (data || []).map(async (message) => {
        const { data: sender } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', message.sender_id)
          .single();
        
        return { ...message, sender };
      })
    );
    
    return messagesWithSenders;
  }

  static async sendMessage(claimId: string, message: string): Promise<ChatMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        claim_id: claimId,
        sender_id: user.id,
        message,
        message_type: 'text'
      })
      .select('*')
      .single();

    if (error) throw error;
    
    // Fetch sender details
    const { data: sender } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', data.sender_id)
      .single();
    
    return { ...data, sender };
  }

  static async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  }

  static subscribeToMessages(claimId: string, callback: (message: ChatMessage) => void) {
    return supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `claim_id=eq.${claimId}`
        },
        async (payload) => {
          // Fetch the complete message with sender info
          const { data: message } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('id', payload.new.id)
            .single();
          
          if (message) {
            const { data: sender } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .eq('id', message.sender_id)
              .single();
            
            callback({ ...message, sender });
          }
        }
      )
      .subscribe();
  }
}