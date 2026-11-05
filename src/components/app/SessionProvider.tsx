'use client'

// ログイン状態と「わたし」(/api/me)を全画面で共有する。1人1アカウントで「相談する / 支える」を切り替える(盤 03・04)。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { apiFetch, ApiError } from '@/lib/client/api'
import type { MeResponse } from '@/lib/client/meTypes'
import { usePathname, useRouter } from '@/i18n/navigation'
import { isAppLocale } from '@/i18n/routing'

export type Mode = 'consult' | 'support'

type ReadyMe = Extract<MeResponse, { onboarded: true }>

type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'suspended' }
  | { status: 'needsOnboarding'; email: string | null }
  | { status: 'ready'; me: ReadyMe }

type SessionContextValue = {
  state: SessionState
  session: Session | null
  mode: Mode
  canSupport: boolean
  setMode: (mode: Mode) => void
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)
const MODE_KEY = 'samasama.mode'
const LOCALE_RESTORED_KEY = 'samasama.localeRestored'

function readStoredMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'support' ? 'support' : 'consult'
  } catch {
    return 'consult'
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  const [session, setSession] = useState<Session | null>(null)
  const [mode, setModeState] = useState<Mode>('consult')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const loadingRef = useRef(0)

  const load = useCallback(async (current: Session | null) => {
    const ticket = ++loadingRef.current
    if (!current) {
      setState({ status: 'anonymous' })
      return
    }
    try {
      const me = await apiFetch<MeResponse>('/api/me')
      if (ticket !== loadingRef.current) return
      setState(me.onboarded ? { status: 'ready', me } : { status: 'needsOnboarding', email: me.email })
    } catch (error) {
      if (ticket !== loadingRef.current) return
      if (error instanceof ApiError && error.code === 'SUSPENDED') {
        setState({ status: 'suspended' })
        return
      }
      if (error instanceof ApiError && error.status === 401) {
        await supabase.auth.signOut()
        setState({ status: 'anonymous' })
        return
      }
      console.error('[session] me:', error)
      setState({ status: 'anonymous' })
    }
  }, [])

  useEffect(() => {
    setModeState(readStoredMode())
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      void load(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'MFA_CHALLENGE_VERIFIED') {
        void load(next)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  // 本人が選んだ言語に合わせる(セッションのあいだ1回だけ。そのあとは画面の切り替えを優先する)
  useEffect(() => {
    if (state.status !== 'ready') return
    const preferred = state.me.person.locale
    if (!isAppLocale(preferred) || preferred === locale) return
    try {
      if (window.sessionStorage.getItem(LOCALE_RESTORED_KEY)) return
      window.sessionStorage.setItem(LOCALE_RESTORED_KEY, '1')
    } catch {
      return
    }
    router.replace(pathname, { locale: preferred })
  }, [state, locale, pathname, router])

  const canSupport = state.status === 'ready'
    && state.me.person.role === 'PERSON'
    && (state.me.faces.organizations.length > 0 || state.me.faces.individual !== null)

  const setMode = useCallback((next: Mode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(MODE_KEY, next)
    } catch {
      // 保存できなくても今の画面では切り替わる
    }
  }, [])

  const value = useMemo<SessionContextValue>(() => ({
    state,
    session,
    mode: canSupport ? mode : 'consult',
    canSupport,
    setMode,
    refresh: () => load(session),
    signOut: async () => {
      await supabase.auth.signOut()
      try {
        window.sessionStorage.removeItem(LOCALE_RESTORED_KEY)
      } catch {
        // なにもしない
      }
      setState({ status: 'anonymous' })
    },
  }), [state, session, mode, canSupport, setMode, load])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

export function useReadyMe(): ReadyMe | null {
  const { state } = useSession()
  return state.status === 'ready' ? state.me : null
}
