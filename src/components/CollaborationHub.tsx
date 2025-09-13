import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
    full_name?: string
  }
}

interface CollaborationSession {
  id: string
  claim_id: string
  host_id: string
  session_type: 'video' | 'whiteboard' | 'screen_share'
  session_url?: string
  is_active: boolean
  participants: string[]
  settings: any
  created_at: string
}

interface WhiteboardElement {
  id: string
  element_type: 'drawing' | 'text' | 'image' | 'file' | 'sticky_note'
  element_data: any
  position_x: number
  position_y: number
  user_id: string
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
  const { data: messages, isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: ['chat-messages', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return []
      
      console.log('Fetching chat messages for claim:', selectedClaim)
      
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('claim_id', selectedClaim)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching chat messages:', error)
        throw error
      }
      
      console.log('Raw chat messages:', messages)
      
      // Fetch sender details separately
      const messagesWithSenders = await Promise.all(
        (messages || []).map(async (message) => {
          const { data: sender } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', message.sender_id)
            .single()
          
          return { ...message, sender }
        })
      )
      
      console.log('Messages with senders:', messagesWithSenders)
      return messagesWithSenders as ChatMessage[]
    },
    enabled: !!selectedClaim
  })

  // Active collaboration sessions query
  const { data: activeSessions } = useQuery({
    queryKey: ['collaboration-sessions', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return []
      
      const { data, error } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .eq('claim_id', selectedClaim)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as CollaborationSession[]
    },
    enabled: !!selectedClaim
  })

  // Whiteboard data query
  const { data: whiteboardData } = useQuery({
    queryKey: ['whiteboard-data', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return []
      
      const { data, error } = await supabase
        .from('whiteboard_data')
        .select('*')
        .eq('claim_id', selectedClaim)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data as WhiteboardElement[]
    },
    enabled: !!selectedClaim && activeTab === 'whiteboard'
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: {
      message: string
      message_type: string
      file_url?: string
      file_name?: string
      file_size?: number
      metadata?: any
    }) => {
      if (!selectedClaim || !currentUserId) throw new Error('Missing required data')
      
      console.log('Sending message:', { selectedClaim, currentUserId, messageData })
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          claim_id: selectedClaim,
          sender_id: currentUserId,
          ...messageData
        }])
        .select()
        .single()
      
      if (error) {
        console.error('Error sending message:', error)
        throw error
      }
      
      console.log('Message sent successfully:', data)
      return data
    },
    onSuccess: () => {
      console.log('Invalidating chat messages query')
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedClaim] })
      setNewMessage('')
    },
    onError: (error) => {
      console.error('Send message error:', error)
    }
  })

  // Start collaboration session mutation
  const startSessionMutation = useMutation({
    mutationFn: async (sessionData: {
      session_type: 'video' | 'whiteboard' | 'screen_share'
      session_url?: string
      settings?: any
    }) => {
      if (!selectedClaim || !currentUserId) throw new Error('Missing required data')
      
      const { data, error } = await supabase
        .from('collaboration_sessions')
        .insert([{
          claim_id: selectedClaim,
          host_id: currentUserId,
          ...sessionData
        }])
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaboration-sessions'] })
    }
  })

  // Save whiteboard element mutation
  const saveWhiteboardElementMutation = useMutation({
    mutationFn: async (elementData: {
      element_type: string
      element_data: any
      position_x: number
      position_y: number
    }) => {
      if (!selectedClaim || !currentUserId) throw new Error('Missing required data')
      
      const { data, error } = await supabase
        .from('whiteboard_data')
        .insert([{
          claim_id: selectedClaim,
          user_id: currentUserId,
          ...elementData
        }])
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whiteboard-data'] })
    }
  })

  // Request media permissions
  const requestMediaPermissions = async (video: boolean = false, audio: boolean = true) => {
    try {
      const constraints = {
        video: video ? { width: 640, height: 480 } : false,
        audio: audio
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setMediaStream(stream)
      
      if (video && videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      setIsVideoOn(video)
      setIsAudioOn(audio)
      
      return stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      alert('Unable to access camera/microphone. Please check permissions.')
      return null
    }
  }

  // Start video call
  const startVideoCall = async () => {
    const stream = await requestMediaPermissions(true, true)
    if (stream) {
      // In production, integrate with Zoom SDK, Jitsi Meet, or WebRTC
      const meetingUrl = `https://meet.jit.si/legal-claim-${selectedClaim}-${Date.now()}`
      
      startSessionMutation.mutate({
        session_type: 'video',
        session_url: meetingUrl,
        settings: { video: true, audio: true }
      })
      
      // Open meeting in new window
      window.open(meetingUrl, '_blank', 'width=1200,height=800')
    }
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return
    
    // In production, upload to Supabase Storage or similar
    const fileUrl = URL.createObjectURL(file)
    const fileType = file.type.startsWith('image/') ? 'image' : 'file'
    
    sendMessageMutation.mutate({
      message: `Shared ${file.name}`,
      message_type: fileType,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size
    })
  }

  // Handle whiteboard drawing
  const handleWhiteboardDraw = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.strokeStyle = claimColor
    ctx.lineWidth = 2
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  // Save whiteboard content as evidence
  const saveWhiteboardAsEvidence = async () => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const imageData = canvas.toDataURL('image/png')
    
    // Save to whiteboard data
    saveWhiteboardElementMutation.mutate({
      element_type: 'image',
      element_data: { imageData, tool: whiteboardTool },
      position_x: 0,
      position_y: 0
    })
    
    // Send as chat message
    sendMessageMutation.mutate({
      message: 'Shared whiteboard content',
      message_type: 'whiteboard_share',
      file_url: imageData,
      file_name: `whiteboard-${Date.now()}.png`
    })
  }

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    
    sendMessageMutation.mutate({
      message: newMessage,
      message_type: 'text'
    })
  }

  if (!selectedClaim) {
    return (
      <div className="text-center py-8 text-gray-500">
        Select a claim to start collaborating
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 rounded-lg p-4" style={{ 
        borderLeftColor: claimColor,
        backgroundColor: `${claimColor}10`
      }}>
        <div className="flex justify-between items-center">
        <p style={{ color: claimColor }}>
          Collaboration Hub for claim: <strong>{selectedClaim}</strong>
        </p>
          <button
            onClick={() => window.location.href = '#subscription'}
            className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center space-x-1"
          >
            <Crown className="w-3 h-3" />
            <span>Subscription</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow border">
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
            <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
              {messagesLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messagesError ? (
                <div className="text-center text-red-500">
                  Error loading messages: {messagesError.message}
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: claimColor }}
                        >
                          {message.sender.email.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">{message.sender.email}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mt-1">
                          {message.message_type === 'text' && (
                            <p className="text-gray-800">{message.message}</p>
                          )}
                          {message.message_type === 'file' && (
                            <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                              <Paperclip className="w-4 h-4 text-gray-500" />
                              <span className="text-sm">{message.file_name}</span>
                              <button className="text-blue-600 hover:text-blue-800">
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {message.message_type === 'image' && (
                            <div className="mt-2">
                              <img 
                                src={message.file_url} 
                                alt={message.file_name}
                                className="max-w-xs rounded border"
                              />
                            </div>
                          )}
                          {message.message_type === 'whiteboard_share' && (
                            <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded border">
                              <Palette className="w-4 h-4 text-blue-600" />
                              <span className="text-sm text-blue-800">Whiteboard content shared</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500">No messages yet. Start the conversation!</div>
              )}
            </div>
            
            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: claimColor }}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}

        {/* Video Conference Tab */}
        {activeTab === 'video' && (
          <div className="p-6">
            <div className="text-center space-y-4">
              <div className="bg-gray-100 rounded-lg p-8">
                <Video className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Video Conference</h3>
                <p className="text-gray-600 mb-4">
                  Start a video call with all claim participants. This will open a secure meeting room.
                </p>
                
                {/* Media Controls */}
                <div className="flex justify-center space-x-4 mb-6">
                  <button
                    onClick={() => requestMediaPermissions(false, !isAudioOn)}
                    className={`p-3 rounded-full ${
                      isAudioOn ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => requestMediaPermissions(!isVideoOn, isAudioOn)}
                    className={`p-3 rounded-full ${
                      isVideoOn ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {isVideoOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                  </button>
                </div>

                {/* Video Preview */}
                {isVideoOn && (
                  <div className="mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-64 h-48 mx-auto rounded-lg border"
                    />
                  </div>
                )}

                <button
                  onClick={startVideoCall}
                  className="text-white px-6 py-3 rounded-lg hover:opacity-90 flex items-center space-x-2 mx-auto"
                  style={{ backgroundColor: claimColor }}
                >
                  <Video className="w-5 h-5" />
                  <span>Start Video Conference</span>
                </button>
              </div>

              {/* Active Sessions */}
              {activeSessions && activeSessions.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Active Sessions</h4>
                  {activeSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between bg-white p-3 rounded border">
                      <div>
                        <span className="font-medium">{session.session_type} Session</span>
                        <span className="text-sm text-gray-500 ml-2">
                          Started {new Date(session.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {session.session_url && (
                        <button
                          onClick={() => window.open(session.session_url, '_blank')}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Join
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Whiteboard Tab */}
        {activeTab === 'whiteboard' && (
          <div className="p-6">
            <div className="space-y-4">
              {/* Whiteboard Tools */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setWhiteboardTool('pen')}
                    className={`p-2 rounded ${whiteboardTool === 'pen' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setWhiteboardTool('text')}
                    className={`p-2 rounded ${whiteboardTool === 'text' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  >
                    <Type className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setWhiteboardTool('rectangle')}
                    className={`p-2 rounded ${whiteboardTool === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setWhiteboardTool('circle')}
                    className={`p-2 rounded ${whiteboardTool === 'circle' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  >
                    <Circle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setWhiteboardTool('line')}
                    className={`p-2 rounded ${whiteboardTool === 'line' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700 flex items-center space-x-1"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </button>
                  <button
                    onClick={saveWhiteboardAsEvidence}
                    className="text-white px-3 py-2 rounded text-sm hover:opacity-90 flex items-center space-x-1"
                    style={{ backgroundColor: claimColor }}
                  >
                    <Save className="w-4 h-4" />
                    <span>Save to Evidence</span>
                  </button>
                </div>
              </div>

              {/* Whiteboard Canvas */}
              <div className="border-2 border-gray-300 rounded-lg">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full cursor-crosshair"
                  onMouseDown={() => setIsDrawing(true)}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseMove={handleWhiteboardDraw}
                  style={{ backgroundColor: 'white' }}
                />
              </div>

              {/* Collaboration Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Live Collaboration</span>
                </div>
                <p className="text-blue-800 text-sm mt-1">
                  All participants can draw, type, and upload files to this whiteboard. 
                  {isGuest ? ' Your contributions will be submitted for host approval before being added to evidence.' : ' You can save content directly to evidence.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CollaborationHub