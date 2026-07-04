import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // { id, email, role }
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // fetchApi: attaches bearer token + API base URL to every backend call.
  const fetchApi = useCallback(
    async (path, options = {}) => {
      const token = session?.access_token

      const headers = {
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      }

      const res = await fetch(`${API_URL}${path}`, { ...options, headers })

      if (!res.ok) {
        let detail = res.statusText
        try {
          const data = await res.json()
          detail = data.detail || data.message || JSON.stringify(data)
        } catch {
          // response wasn't JSON, keep statusText
        }
        throw new Error(detail || `Request failed: ${res.status}`)
      }

      if (res.status === 204) return null
      return res.json()
    },
    [session],
  )

  // Load the user's role from the backend once we have a session.
  const loadProfile = useCallback(
    async (currentSession) => {
      if (!currentSession) {
        setProfile(null)
        return
      }
      setProfileLoading(true)
      try {
        const token = currentSession.access_token
        const res = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json()
        setProfile(data)
      } catch (err) {
        console.error('Failed to load /me profile', err)
        setProfile(null)
      } finally {
        setProfileLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      loadProfile(initialSession)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      loadProfile(newSession)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    profileLoading,
    fetchApi,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
