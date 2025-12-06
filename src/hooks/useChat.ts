import { useState, useEffect, useCallback } from 'react';
import { ChatService } from '@/services/chatService';
import { ChatMessage } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useChat = (claimId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    if (!claimId) return;
    
    try {
      setLoading(true);
      const data = await ChatService.getMessages(claimId);
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load chat messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [claimId, toast]);

  const sendMessage = useCallback(async (message: string) => {
    if (!user || !claimId || !message.trim()) return;

    try {
      setSending(true);
      await ChatService.sendMessage(claimId, message.trim());
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }, [user, claimId, toast]);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await ChatService.deleteMessage(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast({
        title: "Success",
        description: "Message deleted",
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!claimId) return;

    const channel = ChatService.subscribeToMessages(claimId, (newMessage) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [claimId]);

  return {
    messages,
    loading,
    sending,
    sendMessage,
    deleteMessage,
    refetch: fetchMessages
  };
};