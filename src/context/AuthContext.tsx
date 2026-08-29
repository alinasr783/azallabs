import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session, Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type OAuthProvider = Extract<Provider, 'google' | 'github' | 'azure' | 'apple'>

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  continueAsGuest: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      // Fallback if network or auth error
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Check if guest user was stored
    const savedGuest = localStorage.getItem('azal_guest_user')
    if (savedGuest && !session) {
      try {
        const guestData = JSON.parse(savedGuest)
        setUser(guestData as User)
      } catch (e) {
        console.error(e)
      }
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      localStorage.removeItem('azal_guest_user')
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
      if (data.session) {
        setSession(data.session)
        setUser(data.user)
        localStorage.removeItem('azal_guest_user')
        return { error: null, needsEmailConfirmation: false }
      }
      
      // As requested by user: "مش شرط اني اعمل check على ال mail حاليا خااالص"
      // If Supabase has email confirmation enabled, create local session state so user can use the MVP right away!
      const mockUser = {
        id: data.user?.id || 'usr_' + Math.random().toString(36).substring(2, 9),
        email: email,
        user_metadata: { name: email.split('@')[0] },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User

      setUser(mockUser)
      localStorage.setItem('azal_guest_user', JSON.stringify(mockUser))
      return { error: null, needsEmailConfirmation: false }
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
    await supabase.auth.signOut()
    localStorage.removeItem('azal_guest_user')
    setUser(null)
    setSession(null)
  }

  const continueAsGuest = () => {
    const guestUser = {
      id: 'guest_' + Math.random().toString(36).substring(2, 9),
      email: 'guest@azallabs.ai',
      user_metadata: { name: 'زائر تجريبي' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User

    setUser(guestUser)
    localStorage.setItem('azal_guest_user', JSON.stringify(guestUser))
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithOAuth, signOut, continueAsGuest }}>
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
