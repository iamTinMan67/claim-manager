import React, { useState, useEffect, useRef } from 'react'
import { DailyProvider, useDaily, useParticipant, useLocalSessionId } from '@daily-co/daily-react'
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Users, Settings } from 'lucide-react'

interface VideoConferenceProps {
  claimId: string
  onClose?: () => void
}

// Daily.co API key - you'll need to get this from daily.co dashboard
const DAILY_API_KEY = import.meta.env.VITE_DAILY_API_KEY || 'demo-key'

// Video call component
const VideoCall = ({ claimId, onClose }: VideoConferenceProps) => {
  const daily = useDaily()
  const localSessionId = useLocalSessionId()
  const [isJoined, setIsJoined] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [participants, setParticipants] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create room name based on claim ID
  const roomName = `claim-${claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

  useEffect(() => {
    if (!daily) return

    const setupCall = async () => {
      try {
        setIsLoading(true)
        
        // Create or join room
        await daily.join({
          url: `https://claim-manager.daily.co/${roomName}`,
          userName: `User ${Math.random().toString(36).substr(2, 9)}`, // Random user name for demo
          startVideoOff: !isVideoOn,
          startAudioOff: !isAudioOn,
        })

        setIsJoined(true)
        setError(null)
      } catch (err) {
        setError('Failed to join video call. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    setupCall()

    // Set up event listeners
    const handleParticipantJoined = (event: any) => {
      setParticipants(prev => [...prev, event.participant])
    }

    const handleParticipantLeft = (event: any) => {
      setParticipants(prev => prev.filter(p => p.session_id !== event.participant.session_id))
    }

    const handleCallEnded = () => {
      setIsJoined(false)
      setParticipants([])
    }

    daily
      .on('participant-joined', handleParticipantJoined)
      .on('participant-left', handleParticipantLeft)
      .on('call-ended', handleCallEnded)

    return () => {
      if (daily) {
        daily.off('participant-joined', handleParticipantJoined)
        daily.off('participant-left', handleParticipantLeft)
        daily.off('call-ended', handleCallEnded)
      }
    }
  }, [daily, roomName, isVideoOn, isAudioOn])

  const toggleVideo = () => {
    if (daily) {
      daily.setLocalVideo(!isVideoOn)
      setIsVideoOn(!isVideoOn)
    }
  }

  const toggleAudio = () => {
    if (daily) {
      daily.setLocalAudio(!isAudioOn)
      setIsAudioOn(!isAudioOn)
    }
  }

  const leaveCall = () => {
    if (daily) {
      daily.leave()
      setIsJoined(false)
      setParticipants([])
      if (onClose) onClose()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 card-enhanced rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p className="text-gold">Joining video call...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 card-enhanced rounded-lg">
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️</div>
          <p className="text-gold mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-gold px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card-enhanced rounded-lg overflow-hidden">
      {/* Video Grid */}
      <div className="relative h-64 bg-gray-800 rounded-t-lg">
        {participants.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gold-light">
            <div className="text-center">
              <Video className="w-12 h-12 mx-auto mb-2" />
              <p>Video call ready - waiting for participants...</p>
              <p className="text-sm mt-2">Room: {roomName}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-2 h-full">
            {participants.map((participant) => (
              <ParticipantVideo key={participant.session_id} participant={participant} />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-white text-sm">
            <Users className="w-4 h-4 inline mr-1" />
            {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-full ${
              isVideoOn ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'
            } hover:bg-opacity-80`}
            title={isVideoOn ? 'Turn off video' : 'Turn on video'}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleAudio}
            className={`p-2 rounded-full ${
              isAudioOn ? 'bg-gray-600 text-white' : 'bg-red-600 text-white'
            } hover:bg-opacity-80`}
            title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={leaveCall}
            className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Room Info */}
      <div className="bg-gray-700 px-4 py-2 text-center rounded-b-lg">
        <p className="text-gray-300 text-sm">
          Room: <span className="font-mono">{roomName}</span>
        </p>
      </div>
    </div>
  )
}

// Individual participant video component
const ParticipantVideo = ({ participant }: { participant: any }) => {
  const videoElement = useRef<HTMLVideoElement>(null)
  const { videoTrack, audioTrack, userName } = useParticipant(participant.session_id)

  useEffect(() => {
    if (videoElement.current && videoTrack) {
      videoElement.current.srcObject = new MediaStream([videoTrack])
    }
  }, [videoTrack])

  return (
    <div className="relative bg-gray-600 rounded-lg overflow-hidden">
      <video
        ref={videoElement}
        autoPlay
        playsInline
        muted={participant.local}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
        {userName || 'Unknown User'}
      </div>
    </div>
  )
}

// Main VideoConference component with DailyProvider
const VideoConference = ({ claimId, onClose }: VideoConferenceProps) => {
  const [daily, setDaily] = useState<any>(null)

  useEffect(() => {
    // Initialize Daily.co
    const initDaily = async () => {
      try {
        const { DailyIframe } = await import('@daily-co/daily-js')
        const dailyInstance = DailyIframe.createCallObject({
          apiKey: DAILY_API_KEY,
          showLeaveButton: false,
          showFullscreenButton: false,
          showLocalVideo: true,
          showParticipantsBar: true,
        })
        setDaily(dailyInstance)
      } catch (err) {
        // Handle Daily.co initialization error silently
        console.log('Daily.co not available, using fallback')
        // Create a mock daily object for development
        setDaily({
          join: () => Promise.resolve(),
          leave: () => Promise.resolve(),
          setLocalVideo: () => {},
          setLocalAudio: () => {},
          on: () => {},
          off: () => {},
          destroy: () => {}
        })
      }
    }

    initDaily()

    return () => {
      if (daily) {
        daily.destroy()
      }
    }
  }, [])

  if (!daily) {
    return (
      <div className="flex items-center justify-center h-64 card-enhanced rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p className="text-gold">Initializing video...</p>
        </div>
      </div>
    )
  }

  return (
    <DailyProvider callObject={daily}>
      <VideoCall claimId={claimId} onClose={onClose} />
    </DailyProvider>
  )
}

export default VideoConference
