import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import type { User } from '@supabase/supabase-js'

interface AuthComponentProps {
  children?: React.ReactNode
  onAuthChange: (user: User | null) => void
}

export default function AuthComponent({ children, onAuthChange }: AuthComponentProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Get initial session
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
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
            redirectTo={window.location.origin}
            onlyThirdPartyProviders={false}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold dark:text-white">Management</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Welcome, {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  )
}