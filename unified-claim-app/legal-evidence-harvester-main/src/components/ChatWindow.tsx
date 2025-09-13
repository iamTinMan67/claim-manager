import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { ChatMessage } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

interface ChatWindowProps {
  claimId: string;
  isOpen: boolean;
  onToggle: () => void;
}

const MessageItem: React.FC<{
  message: ChatMessage;
  currentUserId: string;
  onDelete: (messageId: string) => void;
}> = ({ message, currentUserId, onDelete }) => {
  const isOwn = message.sender_id === currentUserId;
  const senderInitials = message.sender?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 max-w-[80%]`}>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{senderInitials}</AvatarFallback>
        </Avatar>
        
        <div className={`rounded-lg p-3 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {isOwn ? 'You' : message.sender?.full_name || 'Unknown'}
            </span>
            <span className="text-xs opacity-70">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
          
          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(message.id)}
              className="mt-2 h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ claimId, isOpen, onToggle }) => {
  const [newMessage, setNewMessage] = useState('');
  const { messages, loading, sending, sendMessage, deleteMessage } = useChat(claimId);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    await sendMessage(newMessage);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 h-96 shadow-lg z-50 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Chat
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-2">
        <ScrollArea className="flex-1 px-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground text-center">
                No messages yet.<br />Start the conversation!
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  currentUserId={user?.id || ''}
                  onDelete={deleteMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
        
        <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || !newMessage.trim()}
            className="px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};