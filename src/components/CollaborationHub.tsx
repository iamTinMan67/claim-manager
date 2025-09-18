import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import VideoConference from './VideoConference'
import { 
  MessageCircle, 
  Video, 
  Send, 
  Users,
  FileText,
  Paperclip,
  Trash2
} from 'lucide-react'

interface CollaborationHubProps {
  selectedClaim: string | null
  claimColor?: string
  isGuest?: boolean
  currentUserId?: string
}

interface ChatMessage {
  id: string
  claim_id: string
  sender_id: string
  message: string
  message_type: 'text' | 'file' | 'image' | 'audio' | 'video' | 'document' | 'system' | 'whiteboard_share'
  file_url?: string
  file_name?: string
  file_size?: number
  metadata?: any
  created_at: string
  sender: {
    email: string
    full_name: string
  }
}

interface WhiteboardElement {
  id: string
  type: 'pen' | 'text' | 'rectangle' | 'circle' | 'line'
  data: any
  position: { x: number; y: number }
  created_at: string
}

const CollaborationHub = ({ selectedClaim, claimColor = '#3B82F6', isGuest = false, currentUserId }: CollaborationHubProps) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'video' | 'documents'>('chat')
  const [newMessage, setNewMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [isAudioOn, setIsAudioOn] = useState(false)
  const [meetLink, setMeetLink] = useState('')
  const [docLink, setDocLink] = useState('')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Chat messages query
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return []
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('claim_id', selectedClaim)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      
      // Fetch sender details for each message
      const messagesWithSenders = await Promise.all(
        (data || []).map(async (message) => {
          const { data: senderData } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', message.sender_id)
            .single()
          
          return {
            ...message,
            sender: senderData || { email: 'Unknown', full_name: 'Unknown User' }
          }
        })
      )
      
      return messagesWithSenders as ChatMessage[]
    },
    enabled: !!selectedClaim
  })

  // Compute latest document link AFTER messages is defined to avoid TDZ errors
  const latestDocLink = React.useMemo(() => {
    const list = (messages as any[]) || []
    const last = [...list].reverse().find(m => m.message_type === 'document' && typeof (m.file_url || m.message) === 'string')
    if (!last) return ''
    return last.file_url || (last.message?.match(/https?:\/\/\S+/)?.[0] ?? '')
  }, [messages])

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string; message_type: string; file_url?: string; file_name?: string; file_size?: number }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          claim_id: selectedClaim!,
          sender_id: currentUserId!,
          message: messageData.message,
          message_type: messageData.message_type as any,
          file_url: messageData.file_url,
          file_name: messageData.file_name,
          file_size: messageData.file_size
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedClaim] })
    }
  })

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedClaim || !currentUserId) return
    
    sendMessageMutation.mutate({
      message: newMessage.trim(),
      message_type: 'text'
    })
  }

  const shareMeetLink = () => {
    if (!meetLink.trim() || !selectedClaim || !currentUserId) return
    // Basic validation
    const url = meetLink.trim()
    if (!/^https?:\/\/meet\.google\.com\//.test(url)) return

    sendMessageMutation.mutate({
      message: `Join Google Meet: ${url}`,
      message_type: 'video',
      file_url: url
    })
    setMeetLink('')
  }

  const shareDocumentLink = () => {
    if (!docLink.trim() || !selectedClaim || !currentUserId) return
    const url = docLink.trim()
    // Accept any https URL; owners should paste ONLYOFFICE/Collabora links
    if (!/^https?:\/\//.test(url)) return

    sendMessageMutation.mutate({
      message: `Open Document: ${url}`,
      message_type: 'document',
      file_url: url
    })
    setDocLink('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedClaim || !currentUserId) return

    // For now, just send as text message with file info
    // In a real app, you'd upload the file to storage first
    sendMessageMutation.mutate({
      message: `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      message_type: 'file',
      file_name: file.name,
      file_size: file.size
    })
  }

  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      })
      setMediaStream(stream)
      setIsVideoOn(true)
      setIsAudioOn(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      // Handle media device access error silently
    }
  }

  const stopVideoCall = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      setMediaStream(null)
      setIsVideoOn(false)
      setIsAudioOn(false)
    }
  }

  const toggleVideo = () => {
    if (mediaStream) {
      const videoTrack = mediaStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOn(videoTrack.enabled)
      }
    }
  }

  const toggleAudio = () => {
    if (mediaStream) {
      const audioTrack = mediaStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioOn(audioTrack.enabled)
      }
    }
  }

  if (!selectedClaim) {
    return (
      <div className="card-smudge p-6">
        <div className="flex items-center space-x-2 mb-2">
          <Users className="w-5 h-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-yellow-900">Collaboration Hub</h3>
        </div>
        <p className="text-yellow-800">
          Please select a claim from the list below to start collaborating with chat, video calls, and whiteboard features.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full overflow-hidden overscroll-contain">
      

      {/* Tab Navigation */}
      <div className="card-enhanced rounded-lg shadow border h-full flex flex-col">
        <div className="flex border-b flex-shrink-0">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 px-6 py-3 text-center font-medium ${
              activeTab === 'chat' 
                ? 'border-b-2 text-white' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={activeTab === 'chat' ? { 
              borderBottomColor: claimColor,
              backgroundColor: `${claimColor}20`,
              color: claimColor
            } : {}}
          >
            <MessageCircle className="w-5 h-5 inline mr-2" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 px-6 py-3 text-center font-medium ${
              activeTab === 'video' 
                ? 'border-b-2 text-white' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={activeTab === 'video' ? { 
              borderBottomColor: claimColor,
              backgroundColor: `${claimColor}20`,
              color: claimColor
            } : {}}
          >
            <Video className="w-5 h-5 inline mr-2" />
            Video Conference
          </button>
          
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 px-6 py-3 text-center font-medium ${
              activeTab === 'documents' 
                ? 'border-b-2 text-white' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={activeTab === 'documents' ? { 
              borderBottomColor: claimColor,
              backgroundColor: `${claimColor}20`,
              color: claimColor
            } : {}}
          >
            <FileText className="w-5 h-5 inline mr-2" />
            Documents
          </button>
        </div>

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gold">Chat</h4>
              {!isGuest && (
                <button
                  onClick={async () => {
                    if (!selectedClaim) return
                    if (!window.confirm('Clear all chat messages for this claim? This cannot be undone.')) return
                    try {
                      // Verify user owns the claim before allowing clear
                      const { data: { user } } = await supabase.auth.getUser()
                      if (!user) throw new Error('Not authenticated')
                      
                      const { data: claim, error: claimError } = await supabase
                        .from('claims')
                        .select('user_id')
                        .eq('case_number', selectedClaim)
                        .single()
                      
                      if (claimError || !claim) throw new Error('Claim not found')
                      if (claim.user_id !== user.id) throw new Error('Only the claim owner can clear chat messages')
                      
                      // Get all messages for this claim first
                      const { data: messages, error: fetchError } = await supabase
                        .from('chat_messages')
                        .select('id')
                        .eq('claim_id', selectedClaim)
                      
                      if (fetchError) throw fetchError
                      
                      if (!messages || messages.length === 0) {
                        alert('No messages to clear.')
                        return
                      }
                      
                      // Delete each message individually (due to RLS policies)
                      const deletePromises = messages.map(msg => 
                        supabase.from('chat_messages').delete().eq('id', msg.id)
                      )
                      
                      const results = await Promise.all(deletePromises)
                      const errors = results.filter(result => result.error)
                      
                      if (errors.length > 0) {
                        console.error('Some deletions failed:', errors)
                        throw new Error('Some messages could not be deleted')
                      }
                      
                      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedClaim] })
                      alert(`Chat cleared successfully! Deleted ${messages.length} message(s).`)
                    } catch (error) {
                      console.error('Failed to clear chat:', error)
                      alert(`Failed to clear chat: ${error.message || 'Please try again.'}`)
                    }
                  }}
                  className="bg-white/10 border border-red-400 text-red-400 px-3 py-1 rounded-lg flex items-center space-x-2 hover:opacity-90"
                  title="Clear Chat (Host Only)"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Chat</span>
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg p-4 mb-4 card-enhanced">
              {messagesLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: claimColor }}
                        >
                          {message.sender.full_name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{message.sender.full_name}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-800 mt-1">{message.message}</p>
                        {message.message_type === 'whiteboard_share' && message.file_url && (
                          <div className="mt-2">
                            <img 
                              src={message.file_url} 
                              alt="Whiteboard content" 
                              className="max-w-xs rounded border"
                            />
                            <p className="text-xs text-gray-500 mt-1">Whiteboard shared by {message.sender.full_name}</p>
                          </div>
                        )}
                        {message.file_url && message.message_type !== 'whiteboard_share' && (
                          <div className="mt-2">
                            <a 
                              href={message.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              <FileText className="w-4 h-4 inline mr-1" />
                              {message.file_name || 'Download file'}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500">No messages yet. Start the conversation!</div>
              )}
            </div>
            
            <div className="flex space-x-2 mt-2 flex-shrink-0">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sendMessageMutation.isPending}
              />
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-yellow-400/20 text-gold rounded-lg hover:bg-yellow-400/30"
                title="Upload file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Video Tab */}
        {activeTab === 'video' && (
          <div className="p-6 overflow-auto">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">Video Conference</h3>
              <p className="text-gray-600">Choose a provider or join an existing link</p>
            </div>

            {/* If any message contains a Meet link, show a Join button */}
            {messages && (messages as any[]).some(m => m.message_type === 'video' && /^https?:\/\/meet\.google\.com\//.test(m.file_url || m.message)) ? (
              <div className="card-enhanced p-4 mb-4">
                <h4 className="font-semibold mb-2">Google Meet Link Shared</h4>
                <button
                  onClick={() => {
                    const latest = [...(messages as any[])].reverse().find(m => m.message_type === 'video' && /^https?:\/\/meet\.google\.com\//.test(m.file_url || m.message))
                    const href = latest?.file_url || (latest?.message?.match(/https?:\/\/meet\.google\.com\/[\w-]+/g)?.[0] ?? '')
                    if (href) window.open(href, '_blank')
                  }}
                  className="bg-white/10 border border-green-400 text-green-400 px-4 py-2 rounded-lg hover:opacity-90"
                >
                  Join Google Meet
                </button>
              </div>
            ) : null}

            {/* Owner-only: share a Meet link */}
            {!isGuest && (
              <div className="card-smudge p-4 mb-4 flex items-center space-x-2">
                <input
                  type="url"
                  placeholder="Paste Google Meet link (https://meet.google.com/...)"
                  value={meetLink}
                  onChange={(e) => setMeetLink(e.target.value)}
                  className="flex-1 h-10 text-sm border border-yellow-400/30 rounded-md px-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                />
                <button
                  onClick={shareMeetLink}
                  className="bg-white/10 border border-green-400 text-green-400 px-4 py-2 rounded-lg hover:opacity-90"
                >
                  Share Meet Link
                </button>
              </div>
            )}

            {/* Owner-only: share a document (ONLYOFFICE/Collabora) */}
            {!isGuest && (
              <div className="card-smudge p-4 mb-4 flex items-center space-x-2">
                <input
                  type="url"
                  placeholder="Paste document link (ONLYOFFICE/Collabora/Nextcloud)"
                  value={docLink}
                  onChange={(e) => setDocLink(e.target.value)}
                  className="flex-1 h-10 text-sm border border-yellow-400/30 rounded-md px-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                />
                <button
                  onClick={shareDocumentLink}
                  className="bg-white/10 border border-green-400 text-green-400 px-4 py-2 rounded-lg hover:opacity-90"
                >
                  Share Document
                </button>
              </div>
            )}

            {/* Fallback: built-in Daily.co video */}
            <VideoConference 
              claimId={selectedClaim} 
              onClose={() => setActiveTab('chat')}
            />
          </div>
        )}

        

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="p-6 space-y-4 overflow-auto">
            {!isGuest && (
              <div className="card-smudge p-4 flex items-center space-x-2">
                <input
                  type="url"
                  placeholder="Paste ONLYOFFICE/Collabora/Nextcloud doc link (https://...)"
                  value={docLink}
                  onChange={(e) => setDocLink(e.target.value)}
                  className="flex-1 h-10 text-sm border border-yellow-400/30 rounded-md px-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                />
                <button
                  onClick={shareDocumentLink}
                  className="bg-white/10 border border-green-400 text-green-400 px-4 py-2 rounded-lg hover:opacity-90"
                >
                  Share Document
                </button>
              </div>
            )}
            {latestDocLink ? (
              <div className="card-enhanced p-0 overflow-hidden rounded-lg border">
                <div className="px-4 py-2 text-sm text-gray-300 border-b flex items-center justify-between">
                  <span>Embedded Document</span>
                  <a href={latestDocLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Open in new tab</a>
                </div>
                <div className="h-[70vh]">
                  <iframe src={latestDocLink} title="Collaborative Document" className="w-full h-full border-0" />
                </div>
              </div>
            ) : (
              <div className="card-enhanced p-6 text-center text-gray-400">
                No document shared yet. {isGuest ? 'Ask the claim owner to share a document link.' : 'Paste and share a document link to embed it here.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CollaborationHub
