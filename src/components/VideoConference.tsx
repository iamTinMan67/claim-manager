import React from 'react'
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users } from 'lucide-react'

interface VideoConferenceProps {
  claimId: string
  onClose?: () => void
}

// Main VideoConference component
const VideoConference = ({ claimId, onClose }: VideoConferenceProps) => {
  return (
    <div className="card-enhanced rounded-lg overflow-hidden">
      <div className="relative h-64 bg-gray-800 rounded-t-lg">
        <div className="flex items-center justify-center h-full text-gold-light">
          <div className="text-center">
            <Video className="w-12 h-12 mx-auto mb-2" />
            <p>Video Conference Ready</p>
            <p className="text-sm mt-2">Room: claim-{claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}</p>
            <p className="text-xs mt-1 text-gray-400">Video calling will be available soon</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-white text-sm">
            <Users className="w-4 h-4 inline mr-1" />
            1 participant
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            className="p-2 rounded-full bg-gray-600 text-white opacity-50 cursor-not-allowed"
            title="Video (Coming Soon)"
          >
            <Video className="w-5 h-5" />
          </button>

          <button
            className="p-2 rounded-full bg-gray-600 text-white opacity-50 cursor-not-allowed"
            title="Audio (Coming Soon)"
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700"
            title="Close"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Room Info */}
      <div className="bg-gray-700 px-4 py-2 text-center rounded-b-lg">
        <p className="text-gray-300 text-sm">
          Room: <span className="font-mono">claim-{claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}</span>
        </p>
      </div>
    </div>
  )
}

export default VideoConference
