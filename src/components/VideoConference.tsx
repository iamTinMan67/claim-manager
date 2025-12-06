import React, { useState, useEffect, useRef } from 'react'
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Settings, Copy } from 'lucide-react'
import { DailyProvider, useDaily, useParticipant, useParticipantIds, useLocalSessionId } from '@daily-co/daily-react'

interface VideoConferenceProps {
  claimId: string
  onClose?: () => void
}

// Video controls component
const VideoControls = ({ onClose }: { onClose?: () => void }) => {
  const daily = useDaily()
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [isMuted, setIsMuted] = useState(false)

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
    }
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className="bg-gray-800 p-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <span className="text-white text-sm">
          <Users className="w-4 h-4 inline mr-1" />
          In call
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={toggleVideo}
          className={`p-2 rounded-full transition-colors ${
            isVideoOn 
              ? 'bg-gray-600 text-white hover:bg-gray-500' 
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
          title={isVideoOn ? 'Turn off video' : 'Turn on video'}
        >
          {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleAudio}
          className={`p-2 rounded-full transition-colors ${
            isAudioOn 
              ? 'bg-gray-600 text-white hover:bg-gray-500' 
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
          title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={leaveCall}
          className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
          title="Leave call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// Participant video component
const ParticipantVideo = ({ participantId }: { participantId: string }) => {
  const participant = useParticipant(participantId)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && participant?.videoTrack) {
      const videoElement = videoRef.current
      videoElement.srcObject = new MediaStream([participant.videoTrack])
    }
  }, [participant?.videoTrack])

  if (!participant) return null

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.local}
        className="w-full h-full object-cover"
      />
      {!participant.video && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-gray-300">
                {participant.userName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <p className="text-sm text-gray-300">{participant.userName || 'Unknown User'}</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {participant.userName || 'Unknown User'}
        {participant.local && ' (You)'}
      </div>
    </div>
  )
}

// Main video conference room component
const VideoConferenceRoom = ({ claimId, onClose }: VideoConferenceProps) => {
  const daily = useDaily()
  const participantIds = useParticipantIds()
  const localId = useLocalSessionId()
  const [isJoining, setIsJoining] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roomUrl, setRoomUrl] = useState('')

  useEffect(() => {
    const joinCall = async () => {
      if (!daily) return

      try {
        const roomName = `claim-${claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        const url = `https://claim-manager.daily.co/${roomName}`
        setRoomUrl(url)

        await daily.join({
          url,
          userName: `User ${Math.random().toString(36).substr(2, 9)}`, // Random name for demo
          startVideoOff: false,
          startAudioOff: false,
        })

        setIsJoining(false)
      } catch (err) {
        console.error('Failed to join call:', err)
        setError('Failed to join video call. Please check your internet connection and try again.')
        setIsJoining(false)
      }
    }

    joinCall()

    return () => {
      if (daily) {
        daily.leave()
      }
    }
  }, [daily, claimId])

  const copyRoomLink = () => {
    navigator.clipboard.writeText(roomUrl)
    // You could add a toast notification here
  }

  if (error) {
    return (
      <div className="card-enhanced rounded-lg overflow-hidden">
        <div className="p-6 text-center">
          <div className="text-red-400 mb-4">
            <VideoOff className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gold mb-2">Connection Error</h3>
          <p className="text-gold-light mb-4">{error}</p>
          <div className="flex space-x-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isJoining) {
    return (
      <div className="card-enhanced rounded-lg overflow-hidden">
        <div className="p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gold mb-2">Joining Video Call</h3>
          <p className="text-gold-light">Connecting to room...</p>
        </div>
      </div>
    )
  }

  const allIds = participantIds || []
  const localParticipantId = localId || null
  const remoteIds = allIds.filter(id => id !== localParticipantId)
  const participantList = allIds

  return (
    <div className="card-enhanced rounded-lg overflow-hidden">
      {/* Video Grid */}
      <div className="relative bg-gray-900 p-4">
        {allIds.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gold-light">
            <div className="text-center">
              <Video className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-xl font-semibold text-gold mb-2">Waiting for participants</h3>
              <p className="text-gold-light mb-4">Share the room link to invite others</p>
              <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
                <p className="text-sm font-mono text-yellow-300">
                  Room: claim-{claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                </p>
              </div>
              <button
                onClick={copyRoomLink}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Room Link</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={`grid gap-4 ${
            allIds.length === 1 ? 'grid-cols-1' :
            allIds.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
            allIds.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'
          }`}>
            {localParticipantId && (
              <ParticipantVideo participantId={localParticipantId} />
            )}
            {remoteIds.map(id => (
              <ParticipantVideo key={id} participantId={id} />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <VideoControls onClose={onClose} />

      {/* Room Info */}
      <div className="bg-gray-700 px-4 py-3 text-center rounded-b-lg">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <p className="text-gray-300 text-sm">
            Room: <span className="font-mono text-yellow-300">claim-{claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}</span>
          </p>
          <button
            onClick={copyRoomLink}
            className="ml-2 p-1 text-gray-400 hover:text-white transition-colors"
            title="Copy room link"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {participantList.length} participant{participantList.length !== 1 ? 's' : ''} in call
        </p>
      </div>
    </div>
  )
}

// Main VideoConference component with DailyProvider
const VideoConference = ({ claimId, onClose }: VideoConferenceProps) => {
  const [dailyConfig, setDailyConfig] = useState<any>(null)

  useEffect(() => {
    const initDaily = async () => {
      const dailyApiKey = import.meta.env.VITE_DAILY_API_KEY
      
      if (!dailyApiKey || dailyApiKey === 'your_daily_api_key_here') {
        console.warn('Daily.co API key not configured. Video conferencing will not work.')
        return
      }

      // Dynamically import Daily.co to avoid SSR issues
      const { DailyProvider } = await import('@daily-co/daily-react')
      
      setDailyConfig({
        dailyConfig: {
          dailyConfig: {
            apiKey: dailyApiKey,
          },
        },
      })
    }

    initDaily()
  }, [])

  if (!dailyConfig) {
    return (
      <div className="card-enhanced rounded-lg overflow-hidden">
        <div className="p-6 text-center">
          <div className="text-yellow-400 mb-4">
            <Settings className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gold mb-2">Video Conferencing Setup Required</h3>
          <p className="text-gold-light mb-4">
            Please configure your Daily.co API key to enable video conferencing.
          </p>
          <div className="bg-gray-700/50 rounded-lg p-3 text-left text-sm">
            <p className="text-yellow-300 mb-2">Setup steps:</p>
            <ol className="text-gray-300 space-y-1">
              <li>1. Go to <a href="https://dashboard.daily.co/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">dashboard.daily.co</a></li>
              <li>2. Create a free account</li>
              <li>3. Get your API key from the Developers section</li>
              <li>4. Add VITE_DAILY_API_KEY to your .env file</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DailyProvider {...dailyConfig}>
      <VideoConferenceRoom claimId={claimId} onClose={onClose} />
    </DailyProvider>
  )
}

export default VideoConference
