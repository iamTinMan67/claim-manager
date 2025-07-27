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
      }
    })

    // Listen for auth errors
    const handleAuthError = (error: any) => {
      if (error?.message?.includes('Invalid login credentials')) {
        setAuthError('Invalid email or password. Please check your credentials and try again.')
      } else if (error?.message?.includes('Email not confirmed')) {
        setAuthError('Please check your email and click the confirmation link before signing in.')
      } else if (error?.message) {
        setAuthError(error.message)
      }
    }

    // Set up error handling for auth operations
    const originalSignIn = supabase.auth.signInWithPassword
    supabase.auth.signInWithPassword = async (credentials) => {
      try {
        const result = await originalSignIn.call(supabase.auth, credentials)
        if (result.error) {
          handleAuthError(result.error)
        }
        return result
      } catch (error) {
        handleAuthError(error)
        throw error
      }
    }

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
            <strong>New user?</strong> Create an account by entering your email and password, then click "Sign up" instead of "Sign in".
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
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Legal Evidence Management</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
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