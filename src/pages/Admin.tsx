import React, { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { XCircle, Search } from 'lucide-react'

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

  const clearSelection = () => {
    setTargetUserId(null)
    setTargetInfo(null)
    setStatusMsg(null)
    setLookupEmail('')
  }

  const grantTier = async (tier: 'free' | 'basic' | 'premium') => {
    if (!targetUserId || !targetInfo) return
    setBusy(true)
    setStatusMsg(null)
    try {
      await ensureOwner()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Grant premium privilege with specific tier (bypasses Stripe)
      const { error: privilegeError } = await supabase
        .from('user_privileges')
        .upsert({
          user_id: targetUserId,
          granted_by: user.id,
          privilege_type: 'premium',
          premium_tier: tier,
          is_active: true,
          expires_at: null, // Never expires
        }, {
          onConflict: 'user_id,privilege_type'
        })

      if (privilegeError) {
        console.error('Error granting privilege:', privilegeError)
        throw privilegeError
      }

      // Also update subscribers table for consistency
      const { error: subscriberError } = await supabase
        .from('subscribers')
        .upsert({
          user_id: targetUserId,
          email: targetInfo.email,
          subscription_tier: tier,
          subscribed: tier !== 'free', // Only 'free' is not subscribed
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (subscriberError) {
        console.error('Error updating subscribers table:', subscriberError)
        // Don't throw - privilege was granted successfully
        setStatusMsg(`${tier.charAt(0).toUpperCase() + tier.slice(1)} tier granted (bypasses Stripe). Note: subscribers table update had an issue.`)
      } else {
        setStatusMsg(`${tier.charAt(0).toUpperCase() + tier.slice(1)} tier granted (bypasses Stripe).`)
      }
    } catch (e: any) {
      console.error('Failed to grant tier:', e)
      setStatusMsg(e?.message || 'Failed to grant tier.')
    } finally {
      setBusy(false)
    }
  }

  const revokeTier = async () => {
    if (!targetUserId || !targetInfo) return
    setBusy(true)
    setStatusMsg(null)
    try {
      await ensureOwner()
      
      // Deactivate privilege
      const { error: privilegeError } = await supabase
        .from('user_privileges')
        .update({ is_active: false })
        .eq('user_id', targetUserId)
        .eq('privilege_type', 'premium')

      if (privilegeError) {
        console.error('Error revoking privilege:', privilegeError)
        throw privilegeError
      }

      // Also update subscribers table to free/unsubscribed
      const { error: subscriberError } = await supabase
        .from('subscribers')
        .upsert({
          user_id: targetUserId,
          email: targetInfo.email,
          subscription_tier: 'free',
          subscribed: false,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (subscriberError) {
        console.error('Error updating subscribers table:', subscriberError)
        // Don't throw - privilege was revoked successfully
        setStatusMsg('Premium tier revoked. Note: subscribers table update had an issue.')
      } else {
        setStatusMsg('Premium tier revoked.')
      }
    } catch (e: any) {
      setStatusMsg(e?.message || 'Failed to revoke tier.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-enhanced p-4 border-l-4" style={{ borderLeftColor: '#22c55e' }}>
        <h2 className="text-xl font-semibold mb-2">Admin Panel</h2>
        <p className="text-sm text-gray-300 mb-3">Search for a user and grant a subscription tier. This bypasses Stripe and grants access directly.</p>

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
          <div className="mt-4 card-smudge p-3 rounded space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-yellow-200">{targetInfo.email}</div>
                {targetInfo.nickname && <div className="text-xs text-yellow-400">{targetInfo.nickname}</div>}
              </div>
              <button
                onClick={clearSelection}
                className="px-2 py-1 rounded-lg bg-white/10 border border-red-400 text-red-400 hover:opacity-90 flex items-center gap-1 text-xs"
                title="Clear selection"
              >
                <XCircle className="w-3 h-3" /> Close
              </button>
            </div>
            
            <div className="border-t border-yellow-400/20 pt-3">
              <div className="text-xs text-yellow-300 mb-2 font-semibold">Grant Subscription Tier</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => grantTier('free')}
                  disabled={busy}
                  className="px-3 h-8 rounded-lg bg-white/10 border border-gray-400 text-gray-300 hover:opacity-90 flex items-center gap-1 text-xs"
                  title="Grant free tier (1 guest)"
                >
                  Free
                </button>
                <button
                  onClick={() => grantTier('basic')}
                  disabled={busy}
                  className="px-3 h-8 rounded-lg bg-white/10 border border-yellow-400 text-yellow-300 hover:opacity-90 flex items-center gap-1 text-xs"
                  title="Grant basic tier (2-7 guests)"
                >
                  Basic
                </button>
                <button
                  onClick={() => grantTier('premium')}
                  disabled={busy}
                  className="px-3 h-8 rounded-lg bg-white/10 border border-green-400 text-green-300 hover:opacity-90 flex items-center gap-1 text-xs"
                  title="Grant premium tier (8+ guests, all features)"
                >
                  Premium
                </button>
                <button
                  onClick={revokeTier}
                  disabled={busy}
                  className="px-3 h-8 rounded-lg bg-white/10 border border-red-400 text-red-400 hover:opacity-90 flex items-center gap-1 text-xs"
                >
                  <XCircle className="w-3 h-3" /> Revoke
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


