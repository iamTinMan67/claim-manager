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
            <Video className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
            <h3 className="text-xl font-semibold text-gold mb-2">Video Conference</h3>
            <p className="text-gold-light mb-3">Ready to connect with your team</p>
            <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
              <p className="text-sm font-mono text-yellow-300">
                Room: claim-{claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}
              </p>
            </div>
            <div className="bg-blue-600/20 border border-blue-400/30 rounded-lg p-3">
              <p className="text-sm text-blue-200">
                🚀 Video calling feature coming soon!
              </p>
              <p className="text-xs text-blue-300 mt-1">
                Share this room link with your team members
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-white text-sm">
            <Users className="w-4 h-4 inline mr-1" />
            Waiting for participants...
          </span>
          <div className="text-xs text-gray-400">
            Room ID: {claimId}
          </div>
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
            className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
            title="Close Video Conference"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Room Info */}
      <div className="bg-gray-700 px-4 py-3 text-center rounded-b-lg">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <p className="text-gray-300 text-sm">
            Room: <span className="font-mono text-yellow-300">claim-{claimId.toLowerCase().replace(/[^a-z0-9]/g, '-')}</span>
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Share this room with your team to start collaborating
        </p>
      </div>
    </div>
  )
}

export default VideoConference
