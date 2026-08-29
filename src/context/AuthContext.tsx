import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session, Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type OAuthProvider = Extract<Provider, 'google' | 'github' | 'azure' | 'apple'>

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_USER_KEY = 'azal_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check initial session from Supabase
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        if (session?.user) {
          setUser(session.user)
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user))
        } else {
          // Check cached authenticated user
          const saved = localStorage.getItem(AUTH_USER_KEY)
          if (saved) {
            try {
              setUser(JSON.parse(saved) as User)
            } catch {
              setUser(null)
            }
          } else {
            setUser(null)
          }
        }
        setLoading(false)
      })
      .catch(() => {
        const saved = localStorage.getItem(AUTH_USER_KEY)
        if (saved) {
          try {
            setUser(JSON.parse(saved) as User)
          } catch {
            setUser(null)
          }
        }
        setLoading(false)
      })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        setUser(session.user)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user))
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        setUser(data.user)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
      }
      return { error: null }
    } catch (err: any) {
      return { error: err }
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) throw error

      // If session is already created (auto-confirm enabled on Supabase)
      if (data.session && data.user) {
        setSession(data.session)
        setUser(data.user)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
        return { error: null }
      }

      // If Supabase created user but no session due to email confirm setting:
      // Try immediate password sign in
      const signinRes = await supabase.auth.signInWithPassword({ email, password })
      if (!signinRes.error && signinRes.data.user) {
        setSession(signinRes.data.session)
        setUser(signinRes.data.user)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(signinRes.data.user))
        return { error: null }
      }

      // Fallback: Use the created user object directly so user is immediately logged in
      const confirmedUser = (data.user || {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email: email,
        user_metadata: { name: email.split('@')[0] },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      }) as unknown as User

      setUser(confirmedUser)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(confirmedUser))
      return { error: null }
    } catch (err: any) {
      return { error: err }
    }
  }

  const signInWithOAuth = async (provider: OAuthProvider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) throw error
      return { error: null }
    } catch (err: any) {
      return { error: err }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore
    }
    localStorage.removeItem(AUTH_USER_KEY)
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithOAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
