import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import type { User } from '@supabase/supabase-js'
import { Calendar, FileText, Users, CheckSquare, Download, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

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
  activeTab = 'claims',
  onTabChange,
  selectedClaim,
  isGuest = false,
  showGuestContent = false,
  onToggleGuestContent
}: AuthComponentProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isPasswordReset, setIsPasswordReset] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetTokens, setResetTokens] = useState<{accessToken: string, refreshToken: string} | null>(null)
  const { theme, setTheme } = useTheme()

  // Navigation items
  const navItems = [
    { id: 'claims', label: 'Claims', icon: FileText },
    { id: 'todos', label: activeTab === 'shared' ? 'Shared To-Do Lists' : 'To-Do Lists', icon: CheckSquare, requiresClaim: true },
    { id: 'calendar', label: activeTab === 'shared' ? 'Shared Calendar' : 'Calendar', icon: Calendar, requiresClaim: true },
    { id: 'export', label: activeTab === 'shared' ? 'Shared Export' : 'Export', icon: Download, requiresClaim: true },
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

    // Only get session if it's not a password reset flow
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      onAuthChange(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      onAuthChange(session?.user ?? null)
      
      // Handle auth errors
      if (event === 'SIGNED_IN') {
        setAuthError(null)
      } else if (event === 'SIGNED_OUT') {
        setAuthError(null)
      } else if (event === 'SIGN_IN_ERROR') {
        setAuthError('Invalid email or password. Please check your credentials or sign up if you don\'t have an account.')
      } else if (event === 'SIGN_UP_ERROR') {
        setAuthError('Failed to create account. Please try again.')
      }
    })

    return () => subscription.unsubscribe()
  }, [onAuthChange])

  const handleSignOut = async () => {
    setAuthError(null)
    await supabase.auth.signOut()
  }

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
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
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
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
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
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
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
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => window.location.href = window.location.origin}
                className="text-blue-600 hover:text-blue-800 text-sm"
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>
          {authError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {authError}
            </div>
          )}
          <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded text-sm">
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="card-smudge shadow-lg border-b border-yellow-400/20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-8">
              {navItems.map((item) => {
                // Hide nav items that require a claim when on claims page and no claim selected
                if (activeTab === 'claims' && item.requiresClaim && !selectedClaim) {
                  return null
                }
                
                // When on shared claims page, allow navigation to todos, calendar, and export
                // but only if a claim is selected
                if (activeTab === 'shared' && item.requiresClaim && !selectedClaim) {
                  return null
                }
                
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange?.(item.id)}
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
              
              {/* Guest Indicator */}
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
                onClick={handleSignOut}
                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                title={user?.email ? `Signed in as: ${user.email}` : 'Sign Out'}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-2">
        {children}
      </div>
    </div>
  )
}