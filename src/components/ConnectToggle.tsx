import React from 'react'
import { supabase } from '@/integrations/supabase/client'

const ConnectToggle: React.FC = () => {
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    const onToggle = () => setConnected((v) => !v)
    window.addEventListener('toggleCollaboration', onToggle as EventListener)
    return () => window.removeEventListener('toggleCollaboration', onToggle as EventListener)
  }, [])

  const handleClick = () => {
    try { window.dispatchEvent(new Event('toggleCollaboration')) } catch {}
  }

  if (!connected) {
    return (
      <button
        onClick={handleClick}
        className="px-3 py-1 rounded-lg text-sm font-medium bg-white/10 border border-green-400 text-green-400 hover:opacity-90"
        title="Connect"
      >
        Connect
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="px-3 py-1 rounded-lg text-sm font-medium bg-white/10 border border-red-400 text-red-400 hover:opacity-90"
      title="Disconnect"
    >
      Disconnect
    </button>
  )
}

export default ConnectToggle


