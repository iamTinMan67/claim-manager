import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import VideoConference from './VideoConference'
import EnhancedWhiteboard from './EnhancedWhiteboard'
import { 
  MessageCircle, 
  Video, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  Share2, 
  Palette, 
  Type, 
  Upload, 
  Send, 
  Phone, 
  PhoneOff,
  Users,
  FileText,
  Image,
  Paperclip,
  Download,
  Trash2,
  Edit3,
  Square,
  Circle,
  Minus,
  Save,
  Crown
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
  message_type: 'text' | 'file' | 'image' | 'audio' | 'video' | 'system' | 'whiteboard_share'
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
  const [activeTab, setActiveTab] = useState<'chat' | 'video' | 'whiteboard'>('chat')
  const [newMessage, setNewMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [isAudioOn, setIsAudioOn] = useState(false)
  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'text' | 'rectangle' | 'circle' | 'line'>('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const [whiteboardElements, setWhiteboardElements] = useState<WhiteboardElement[]>([])
  
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
    <div className="space-y-6">
      {/* Header with Subscription Button */}
      <div className="border-l-4 rounded-lg p-4" style={{ 
        borderLeftColor: claimColor,
        backgroundColor: `${claimColor}10`
      }}>
        <div className="flex justify-between items-center">
          <p style={{ color: claimColor }}>
            Collaboration Hub for claim: <strong>{selectedClaim}</strong>
          </p>
          <button
            onClick={() => {
              // Dispatch custom event to change tab to subscription
              window.dispatchEvent(new CustomEvent('tabChange', { detail: 'subscription' }))
            }}
            className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center space-x-1"
          >
            <Crown className="w-3 h-3" />
            <span>Subscription</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card-enhanced rounded-lg shadow border">
        <div className="flex border-b">
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
            onClick={() => setActiveTab('whiteboard')}
            className={`flex-1 px-6 py-3 text-center font-medium ${
              activeTab === 'whiteboard' 
                ? 'border-b-2 text-white' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={activeTab === 'whiteboard' ? { 
              borderBottomColor: claimColor,
              backgroundColor: `${claimColor}20`,
              color: claimColor
            } : {}}
          >
            <Palette className="w-5 h-5 inline mr-2" />
            Whiteboard
          </button>
        </div>

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="p-6">
            <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 card-enhanced">
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
            
            <div className="flex space-x-2">
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
          <div className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">Video Conference</h3>
              <p className="text-gray-600">Start a video call with other collaborators</p>
            </div>
            
            <VideoConference 
              claimId={selectedClaim} 
              onClose={() => setActiveTab('chat')}
            />
          </div>
        )}

        {/* Whiteboard Tab */}
        {activeTab === 'whiteboard' && (
          <div className="p-6">
            <EnhancedWhiteboard
              selectedClaim={selectedClaim}
              claimColor={claimColor}
              isGuest={isGuest}
              onShare={(imageData) => {
                // Share whiteboard content as chat message
                sendMessageMutation.mutate({
                  message: 'Shared whiteboard content',
                  message_type: 'whiteboard_share',
                  file_url: imageData,
                  file_name: `whiteboard-${Date.now()}.png`
                })
              }}
              onSave={(imageData) => {
                // Save whiteboard content as evidence
                // This could be implemented to save to evidence table
                console.log('Saving whiteboard content:', imageData)
              }}
            />

            {/* Collaboration Notice */}
            <div className="card-enhanced rounded-lg p-4 mt-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-yellow-400" />
                <span className="font-medium text-white">Live Collaboration</span>
              </div>
              <p className="text-gray-300 text-sm mt-1">
                All participants can draw, type, and upload files to this whiteboard. 
                {isGuest ? ' Your contributions will be submitted for host approval before being added to evidence.' : ' You can save content directly to evidence.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CollaborationHub
