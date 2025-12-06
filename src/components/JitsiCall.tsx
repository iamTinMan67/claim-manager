import React, { useEffect, useRef } from 'react'

declare global {
  interface Window { JitsiMeetExternalAPI?: any }
}

interface JitsiCallProps {
  claimId: string
  onClose?: () => void
  height?: number | string
}

const JitsiCall: React.FC<JitsiCallProps> = ({ claimId, onClose, height = 600 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true
    // Proactively request camera/mic to surface the browser permission prompt early
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        stream.getTracks().forEach(t => t.stop())
      } catch {
        // Ignore; user will be able to allow via browser UI
      }
    })()
    function tryInit(attempt = 0) {
      if (!mounted) return
      const parent = containerRef.current
      const API = (window as any).JitsiMeetExternalAPI
      const canInit = parent && API
      if (!canInit) {
        if (attempt < 10) {
          setTimeout(() => tryInit(attempt + 1), 200)
        }
        return
      }
      // If container has zero height initially, delay a bit to allow layout
      const rect = parent!.getBoundingClientRect()
      if ((rect.height === 0 || rect.width === 0) && attempt < 10) {
        setTimeout(() => tryInit(attempt + 1), 200)
        return
      }

      try { apiRef.current?.dispose?.() } catch {}

      apiRef.current = new API('meet.jit.si', {
        parentNode: parent,
        roomName: claimId,
        width: '100%',
        height,
        configOverwrite: { 
          prejoinPageEnabled: true,
          startWithVideoMuted: false,
          startWithAudioMuted: false,
          disableDeepLinking: true
        },
        interfaceConfigOverwrite: {}
      })
    }

    // Load script once
    const scriptId = 'jitsi-external-api'
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script')
      s.id = scriptId
      s.src = 'https://meet.jit.si/external_api.js'
      s.async = true
      s.onload = () => tryInit(0)
      document.body.appendChild(s)
    } else {
      tryInit(0)
    }

    return () => {
      mounted = false
      try { apiRef.current?.dispose?.() } catch {}
    }
  }, [claimId, height, onClose])

  return (
    <div className="w-full">
      <div ref={containerRef} />
    </div>
  )
}

export default JitsiCall


