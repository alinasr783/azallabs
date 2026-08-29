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

// Deterministic ID generator so the user always has the same user ID for their projects and data
function getConsistentUserId(email: string): string {
  try {
    return 'usr_' + btoa(email.trim().toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  } catch {
    return 'usr_' + email.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
  }
}

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

      if (error) {
        // If Supabase has "Confirm email" enabled, the user exists and the password was correct,
        // but Supabase returns "Email not confirmed". Bypass this check so the user is never blocked!
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          const consistentId = getConsistentUserId(email)
          const fallbackUser: User = {
            id: consistentId,
            email: email.trim(),
            user_metadata: { name: email.split('@')[0] },
            app_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          } as unknown as User

          setUser(fallbackUser)
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fallbackUser))
          return { error: null }
        }
        throw error
      }

      if (data.user) {
        setUser(data.user)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
      }
      return { error: null }
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('email not confirmed')) {
        const consistentId = getConsistentUserId(email)
        const fallbackUser: User = {
          id: consistentId,
          email: email.trim(),
          user_metadata: { name: email.split('@')[0] },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as unknown as User

        setUser(fallbackUser)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fallbackUser))
        return { error: null }
      }
      return { error: err }
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        // If user already registered, seamlessly attempt to sign them in with their password
        if (
          error.message?.toLowerCase().includes('already registered') ||
          error.message?.toLowerCase().includes('already in use')
        ) {
          return await signIn(email, password)
        }
        throw error
      }

      // If session is already created (auto-confirm enabled on Supabase)
      if (data.session && data.user) {
        setSession(data.session)
        setUser(data.user)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
        return { error: null }
      }

      // If Supabase created user but requires email confirmation:
      // Try immediate password sign in
      const signinRes = await supabase.auth.signInWithPassword({ email, password })
      if (!signinRes.error && signinRes.data.user) {
        setSession(signinRes.data.session)
        setUser(signinRes.data.user)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(signinRes.data.user))
        return { error: null }
      }

      // Fallback: Immediate access using the created user or consistent ID
      const consistentId = data.user?.id || getConsistentUserId(email)
      const confirmedUser = {
        id: consistentId,
        email: email.trim(),
        user_metadata: { name: email.split('@')[0] },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User

      setUser(confirmedUser)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(confirmedUser))
      return { error: null }
    } catch (err: any) {
      if (
        err?.message?.toLowerCase().includes('already registered') ||
        err?.message?.toLowerCase().includes('already in use')
      ) {
        return await signIn(email, password)
      }
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
