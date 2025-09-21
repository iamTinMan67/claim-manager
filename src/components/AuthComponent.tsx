import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import type { User } from '@supabase/supabase-js'
import { Calendar, FileText, Users, CheckSquare, Download, Moon, Sun, X, Home, Crown } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import SubscriptionManager from './SubscriptionManager'
import PrivilegesStatus from './PrivilegesStatus'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'

interface AuthComponentProps {
  children?: React.ReactNode
  onAuthChange: (user: User | null) => void
  activeTab?: string
  onTabChange?: (tab: string) => void
  selectedClaim?: string | null
  isGuest?: boolean
  showGuestContent?: boolean
  onToggleGuestContent?: (show: boolean) => void
}

export default function AuthComponent({ 
  children, 
  onAuthChange, 
  activeTab,
  onTabChange,
  selectedClaim,
  isGuest = false,
  showGuestContent = false,
  onToggleGuestContent
}: AuthComponentProps) {
  const { user, loading } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)
  const [isPasswordReset, setIsPasswordReset] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetTokens, setResetTokens] = useState<{accessToken: string, refreshToken: string} | null>(null)
  const { theme, setTheme } = useTheme()
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [profileNickname, setProfileNickname] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [newPassword1, setNewPassword1] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [subReady, setSubReady] = useState<boolean>(false)
  const [welcomeNever, setWelcomeNever] = useState<boolean>(false)
  const [welcomeSeenThisSession, setWelcomeSeenThisSession] = useState<boolean>(false)

  // Fetch selected claim details for navbar display
  const { data: selectedClaimData } = useQuery({
    queryKey: ['selected-claim-details', selectedClaim],
    queryFn: async () => {
      if (!selectedClaim) return null
      const { data, error } = await supabase
        .from('claims')
        .select('case_number, title, court')
        .eq('case_number', selectedClaim)
        .single()
      if (error) throw error
      return data
    },
    enabled: Boolean(selectedClaim)
  })

  // Navigation items
  const navItems = activeTab === 'shared'
    ? [
        { id: 'todos-shared', label: 'Shared To-Do Lists', icon: CheckSquare, requiresClaim: true },
        { id: 'calendar-shared', label: 'Shared Calendar', icon: Calendar, requiresClaim: true },
        ...(selectedClaim ? [{ id: 'export', label: 'Export', icon: Download, requiresClaim: true }] : [] as any),
        // { id: 'privileges', label: 'Privileges', icon: Crown }, // Hidden for now
        { id: 'claims', label: 'Private Claims', icon: Home },
        { id: 'shared', label: 'Shared Claims', icon: Users },
      ]
    : [
        { id: 'todos-private', label: 'To-Do Lists', icon: CheckSquare, requiresClaim: true },
        { id: 'calendar-private', label: 'Calendar', icon: Calendar, requiresClaim: true },
        ...(selectedClaim ? [{ id: 'export', label: 'Export', icon: Download, requiresClaim: true }] : [] as any),
        // { id: 'privileges', label: 'Privileges', icon: Crown }, // Hidden for now
        { id: 'shared', label: 'Shared Claims', icon: Users },
      ]

  useEffect(() => {
    // Check if this is a password reset flow - do this FIRST before any auth calls
    
    // Parse hash parameters (Supabase often uses hash for auth tokens)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const searchParams = new URLSearchParams(window.location.search)
    
    // Check both search params and hash for tokens
    const accessToken = searchParams.get('access_token') || hashParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token')
    const type = searchParams.get('type') || hashParams.get('type')
    
    
    // Check for password reset tokens
    if (accessToken && refreshToken) {
      // If we have tokens but no explicit type, check if this looks like a password reset
      // Password reset tokens are typically longer and have a specific format
      if (type === 'recovery' || (accessToken.length > 100 && refreshToken.length > 100)) {
        setIsPasswordReset(true)
        setResetTokens({ accessToken, refreshToken })
        setLoading(false)
        // Clear the URL to prevent auto-login
        window.history.replaceState({}, document.title, window.location.pathname)
        return
      }
    }

    // Load welcome preferences early
    try {
      const never = localStorage.getItem('welcome_never') === '1'
      setWelcomeNever(never)
    } catch {}
    try {
      const seen = sessionStorage.getItem('welcome_seen_session') === '1'
      setWelcomeSeenThisSession(seen)
    } catch {}

    // Listen for welcome acknowledgments triggered elsewhere
    const onPrefs = () => {
      try {
        setWelcomeNever(localStorage.getItem('welcome_never') === '1')
      } catch {}
    }
    window.addEventListener('welcomePrefsChanged', onPrefs as EventListener)

    // Load subscription state when user changes
    if (user?.id) {
      supabase
        .from('subscribers')
        .select('subscribed')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setIsSubscribed(!!data?.subscribed)
          setSubReady(true)
        })
    } else {
      setIsSubscribed(false)
      setSubReady(true)
    }

    return () => {
      window.removeEventListener('welcomePrefsChanged', onPrefs as EventListener)
    }
  }, [onAuthChange])

  const handleSignOut = async () => {
    setAuthError(null)
    await supabase.auth.signOut()
  }

  const handleNavClick = async (tabId: string) => {
    // Allow all navigation since welcome screen is disabled
    if (!subReady) return
    console.log('AuthComponent handleNavClick:', {
      tabId,
      currentTab: activeTab,
      selectedClaim,
      isInSharedContext: activeTab === 'shared'
    })
    onTabChange?.(tabId)
    // Mark welcome as seen for this session when navigating away from subscription
    try {
      if (tabId !== 'subscription') {
        sessionStorage.setItem('welcome_seen_session', '1')
        setWelcomeSeenThisSession(true)
      }
    } catch {}
  }

  const openAccountModal = async () => {
    // Prevent opening only on welcome screen
    if (activeTab === 'subscription') return
    setAccountMessage(null)
    setShowAccountModal(true)
    try {
      const { data: { user: current } } = await supabase.auth.getUser()
      if (current) {
        setAccountEmail(current.email || '')
        // Load profile nickname
        const { data } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', current.id)
          .maybeSingle()
        setProfileNickname((data?.nickname as string) || '')
      }
    } catch {}
  }

  const saveAccountChanges = async () => {
    setAccountMessage(null)
    setAccountSaving(true)
    try {
      const { data: { user: current } } = await supabase.auth.getUser()
      if (!current) throw new Error('Not authenticated')

      // Update profile name
      await supabase
        .from('profiles')
        .update({ nickname: profileNickname })
        .eq('id', current.id)

      // Update email if changed
      if (accountEmail && accountEmail !== (current.email || '')) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: accountEmail })
        if (emailErr) throw emailErr
      }

      // Update password if provided
      if (newPassword1 || newPassword2) {
        if (newPassword1 !== newPassword2) {
          throw new Error('Passwords do not match')
        }
        if (newPassword1.length < 6) {
          throw new Error('Password must be at least 6 characters')
        }
        const { error: passErr } = await supabase.auth.updateUser({ password: newPassword1 })
        if (passErr) throw passErr
      }

      setAccountMessage('Account updated successfully')
      // Brief toast then close modal
      toast({ title: 'Saved', description: 'Your account settings were updated.' })
      setTimeout(() => setShowAccountModal(false), 800)
    } catch (e: any) {
      setAccountMessage(e?.message || 'Failed to update account')
    } finally {
      setAccountSaving(false)
    }
  }

  // Ensure account modal is closed when on welcome screen or not subscribed
  useEffect(() => {
    if (!isSubscribed || activeTab === 'subscription') {
      if (showAccountModal) setShowAccountModal(false)
    }
  }, [isSubscribed, activeTab])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long')
      return
    }

    setResetLoading(true)

    try {
      // Use the stored tokens
      if (!resetTokens) {
        setAuthError('Invalid reset link. Please request a new password reset.')
        setResetLoading(false)
        return
      }

      // First, set the session with the stored tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: resetTokens.accessToken,
        refresh_token: resetTokens.refreshToken
      })

      if (sessionError) {
        setAuthError('Invalid or expired reset link. Please request a new password reset.')
        setResetLoading(false)
        return
      }

      // Now update the password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setAuthError(error.message)
      } else {
        setResetSuccess(true)
        // Redirect to main app after 3 seconds
        setTimeout(() => {
          window.location.href = window.location.origin
        }, 3000)
      }
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    // Show password reset form if this is a reset flow
    if (isPasswordReset) {
      if (resetSuccess) {
        return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="max-w-md w-full card-enhanced rounded-lg shadow-md p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-900/30 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Updated!</h2>
                <p className="text-gray-600 mb-4">
                  Your password has been successfully updated. You will be redirected to the login page shortly.
                </p>
                <button
                  onClick={() => window.location.href = window.location.origin}
                  className="w-full py-2 px-4 rounded"
                  style={{
                    backgroundColor: 'rgba(30, 58, 138, 0.3)',
                    border: '2px solid #10b981',
                    color: '#10b981'
                  }}
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="max-w-md w-full card-enhanced rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-center mb-6">Reset Your Password</h2>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {authError}
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'rgba(30, 58, 138, 0.3)',
                  border: '2px solid #10b981',
                  color: '#10b981'
                }}
              >
                {resetLoading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => window.location.href = window.location.origin}
                className="text-yellow-400 hover:text-yellow-300 text-sm"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Regular login form
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full card-enhanced rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6 text-gold">Sign In</h1>
          {authError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-400 text-red-300 rounded">
              {authError}
            </div>
          )}
          <div className="mb-4 p-3 bg-blue-900/30 border border-blue-400 text-blue-300 rounded text-sm">
            <div className="mb-2">
              <strong>New user?</strong> Create an account by entering your email and password, then click "Sign up" instead of "Sign in".
            </div>
            <div>
              <strong>Existing user?</strong> Enter your registered email and password, then click "Sign in".
            </div>
          </div>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            redirectTo={`${window.location.origin}`}
            onlyThirdPartyProviders={false}
          />
        </div>
      </div>
    )
  }

  // DISABLED: Welcome screen is disabled to fix authentication issues
  const gating = false
  console.log('Gating check:', { subReady, isSubscribed, activeTab, gating: false })

  if (gating) {
    // Ensure account modal is not shown over welcome screen
    if (showAccountModal) setShowAccountModal(false)
    // Do not auto-dismiss here; dismissal happens when user navigates away from subscription
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-2">
          <SubscriptionManager />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div>
        {subReady && !gating && (
          <div className="card-smudge shadow-lg border-b border-yellow-400/20">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center">
                <div className="flex space-x-8">
                  {/* Show navbar items only when welcome is not visible */}
                  {navItems.map((item) => {
                    // Hide nav items that require a claim when no claim is selected (both private and shared)
                    if (item.requiresClaim && !selectedClaim) {
                      return null
                    }
                    // Hide only the current tab link to reduce clutter
                    if ((activeTab === 'calendar-private' && item.id === 'calendar-private') ||
                        (activeTab === 'todos-private' && item.id === 'todos-private') ||
                        (activeTab === 'calendar-shared' && item.id === 'calendar-shared') ||
                        (activeTab === 'todos-shared' && item.id === 'todos-shared') ||
                        (activeTab === 'shared' && item.id === 'shared') ||
                        (activeTab === 'claims' && item.id === 'claims') ||
                        (activeTab === 'privileges' && item.id === 'privileges')) {
                      return null
                    }
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === item.id
                              ? 'border-yellow-400 text-gold'
                              : 'border-transparent text-gold-light hover:text-gold hover:border-yellow-400/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
                
                {/* Selected Claim Information - Center */}
                <div className="flex-1 flex justify-center">
                  <div className="text-center">
                    {selectedClaim && selectedClaimData ? (
                      <div className="text-lg font-semibold text-green-600">
                        <span className="font-bold">
                          {selectedClaimData.court || 'Unknown Court'} - {selectedClaimData.title}
                        </span>
                      </div>
                    ) : (
                      <div className="text-3xl font-bold text-green-600">
                        <span>Claim Manager</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Guest Content Toggle - only show for claim owners when viewing todos/calendar */}
                  {!isGuest && (activeTab === 'todos' || activeTab === 'calendar') && onToggleGuestContent && (
                    <button
                      onClick={() => onToggleGuestContent(!showGuestContent)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        showGuestContent
                          ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                      title={showGuestContent ? 'Switch to your private view' : 'View guest contributions'}
                    >
                      <Users className="w-4 h-4 inline mr-1" />
                      {showGuestContent ? 'Guest View' : 'My View'}
                    </button>
                  )}
                  {isGuest && (
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium">
                      <Users className="w-4 h-4 inline mr-1" />
                      Guest Access
                    </div>
                  )}
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 rounded-lg hover:bg-yellow-400/20 transition-colors text-gold"
                    title="Toggle dark mode"
                  >
                    {theme === 'dark' ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <Moon className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="text-sm bg-blue-900/30 border border-green-400 text-green-400 px-3 py-1 rounded hover:bg-blue-800/50"
                    title={user?.email ? `Account: ${user.email}` : 'Account'}
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="container mx-auto px-4 py-2">
          {children}
        </div>
      </div>

      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 z-[99999] flex items-center justify-center p-4">
          <div className="p-6 rounded-[16px] shadow max-w-lg w-full card-enhanced">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gold">Account Settings</h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="bg-white/10 border border-red-400 text-red-400 px-2 py-1 rounded hover:opacity-90"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {accountMessage && (
              <div className="mb-3 text-sm text-yellow-300">{accountMessage}</div>
            )}

            {/* Privileges Status Component */}
            <div className="mb-6">
              <PrivilegesStatus />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nickname</label>
                <input
                  type="text"
                  value={profileNickname}
                  onChange={(e) => setProfileNickname(e.target.value)}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  placeholder="Your nickname"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  placeholder="you@example.com"
                />
                <p className="text-xs text-gold-light mt-1">You may need to confirm via email.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword1}
                    onChange={(e) => setNewPassword1(e.target.value)}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                    className="w-full border border-yellow-400/30 rounded-lg px-3 py-2 bg-white/10 text-gold placeholder-yellow-300/70 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => { setShowAccountModal(false); onTabChange?.('subscription') }}
                  className="px-4 py-2 text-slate-900 bg-gradient-to-r from-yellow-300 to-yellow-400 font-semibold rounded-lg hover:from-yellow-400 hover:to-yellow-500"
                >
                  Upgrade
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Sign Out
                </button>
                <button
                  onClick={saveAccountChanges}
                  disabled={accountSaving}
                  className="px-4 py-2 text-slate-900 bg-gradient-to-r from-yellow-400 to-yellow-500 font-semibold rounded-lg hover:from-yellow-500 hover:to-yellow-600 disabled:opacity-50"
                >
                  {accountSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}