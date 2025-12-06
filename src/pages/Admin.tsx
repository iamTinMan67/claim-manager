import React, { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { CheckCircle, XCircle, Search, UserPlus, UserMinus } from 'lucide-react'

const OWNER_ID = 'f41fbcf1-c378-4594-9a46-fdc198c1a38a'

const Admin: React.FC = () => {
  const [lookupEmail, setLookupEmail] = useState('')
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [targetInfo, setTargetInfo] = useState<{ email: string; nickname?: string | null } | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ensureOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== OWNER_ID) {
      throw new Error('Not authorized')
    }
    return user
  }

  const handleLookup = async () => {
    setStatusMsg(null)
    setTargetUserId(null)
    setTargetInfo(null)
    if (!lookupEmail.trim()) return
    try {
      await ensureOwner()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .ilike('email', lookupEmail.trim())
        .maybeSingle()
      if (error) throw error
      if (!data) {
        setStatusMsg('No user found for that email.')
        return
      }
      setTargetUserId(data.id as string)
      setTargetInfo({ email: data.email as string, nickname: (data as any).nickname })
    } catch (e: any) {
      setStatusMsg(e?.message || 'Lookup failed')
    }
  }

  const upsertSubscription = async (subscribed: boolean, tier: 'free' | 'basic' | 'frontend') => {
    if (!targetUserId) return
    setBusy(true)
    setStatusMsg(null)
    try {
      await ensureOwner()
      const { error } = await supabase.rpc('admin_set_subscription', {
        target_user_id: targetUserId,
        p_subscribed: subscribed,
        p_tier: tier
      })
      if (error) throw error
      setStatusMsg(subscribed ? 'Premium granted.' : 'Premium revoked.')
    } catch (e: any) {
      setStatusMsg(e?.message || 'Update failed (RLS may block this).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-enhanced p-4 border-l-4" style={{ borderLeftColor: '#22c55e' }}>
        <h2 className="text-xl font-semibold mb-2">Admin Panel</h2>
        <p className="text-sm text-gray-300 mb-3">Grant or revoke premium access for any user.</p>

        <div className="flex items-center gap-2">
          <input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="User email"
            className="flex-1 h-10 text-sm border border-yellow-400/30 rounded-md px-3 bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
          />
          <button
            onClick={handleLookup}
            disabled={!lookupEmail.trim() || busy}
            className="px-3 h-10 rounded-lg bg-white/10 border border-green-400 text-green-400 hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
          >
            <Search className="w-4 h-4" /> Lookup
          </button>
        </div>

        {targetUserId && targetInfo && (
          <div className="mt-4 card-smudge p-3 rounded">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-yellow-200">{targetInfo.email}</div>
                {targetInfo.nickname && <div className="text-xs text-yellow-400">{targetInfo.nickname}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => upsertSubscription(true, 'frontend')}
                  disabled={busy}
                  className="px-3 h-8 rounded-lg bg-white/10 border border-green-400 text-green-400 hover:opacity-90 flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" /> Grant Premium
                </button>
                <button
                  onClick={() => upsertSubscription(false, 'free')}
                  disabled={busy}
                  className="px-3 h-8 rounded-lg bg-white/10 border border-red-400 text-red-400 hover:opacity-90 flex items-center gap-1"
                >
                  <XCircle className="w-4 h-4" /> Revoke Premium
                </button>
              </div>
            </div>
          </div>
        )}

        {statusMsg && <div className="mt-3 text-sm text-yellow-300">{statusMsg}</div>}
      </div>
    </div>
  )
}

export default Admin


