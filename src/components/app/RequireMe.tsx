'use client'

// ログインとはじめの質問が済んだ人だけに中身を出す。済んでいなければ /start へ案内する
import { useEffect, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useSession, useReadyMe } from './SessionProvider'
import { Button, Lead, Screen, Spinner } from './ui'
import { ConsentPanel } from './ConsentPanel'
import { loginPathFor } from '@/lib/domain/safeNext'

type ReadyMe = NonNullable<ReturnType<typeof useReadyMe>>

export function RequireMe({ children, admin = false }: { children: (me: ReadyMe) => ReactNode; admin?: boolean }) {
  const { state, signOut } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('app.gate')

  const isAdmin = state.status === 'ready' && state.me.person.role === 'ADMIN'
  useEffect(() => {
    if (state.status === 'anonymous' || state.status === 'needsOnboarding') {
      // usePathname はクエリを含まないので、location から足す(?subject=COMMUNITY が落ちると会社の入口に戻ってしまう)
      router.replace(loginPathFor(pathname, window.location.search))
    } else if (isAdmin && !admin) {
      // 運営は相談する顔と支える顔を持たない
      router.replace('/admin')
    }
  }, [state.status, isAdmin, admin, router, pathname])

  if (state.status === 'suspended') {
    return (
      <Screen>
        <div className="flex flex-col gap-3 pt-16">
          <Lead>{t('suspended')}</Lead>
          <Button variant="outline" onClick={() => void signOut()}>{t('signOut')}</Button>
        </div>
      </Screen>
    )
  }
  if (state.status !== 'ready') return <Screen><Spinner /></Screen>

  const me = state.me
  if (admin && me.person.role !== 'ADMIN') {
    return <Screen><div className="pt-16"><Lead>{t('notAdmin')}</Lead></div></Screen>
  }
  if (!admin && me.person.role === 'ADMIN') return <Screen><Spinner /></Screen>
  if (!me.consentsUpToDate) return <ConsentPanel />
  return <>{children(me)}</>
}

// ログインしていなくても中身を出す(相談を書く画面。ログインは届けるときに求める。2026-11-17 岡本さん)。
// ログインしていない・はじめの質問がまだの人には null を渡す。止められた人・運営・同意が古い人の扱いは RequireMe と同じ
export function OptionalMe({ children }: { children: (me: ReadyMe | null) => ReactNode }) {
  const { state, signOut } = useSession()
  const router = useRouter()
  const t = useTranslations('app.gate')
  const isAdmin = state.status === 'ready' && state.me.person.role === 'ADMIN'
  useEffect(() => {
    // 運営は相談する顔を持たない
    if (isAdmin) router.replace('/admin')
  }, [isAdmin, router])

  if (state.status === 'suspended') {
    return (
      <Screen>
        <div className="flex flex-col gap-3 pt-16">
          <Lead>{t('suspended')}</Lead>
          <Button variant="outline" onClick={() => void signOut()}>{t('signOut')}</Button>
        </div>
      </Screen>
    )
  }
  // セッションが分かるまで中身を出さない(下書きを端末から読むのは、ブラウザで描くときだけにする)
  if (state.status === 'loading' || isAdmin) return <Screen><Spinner /></Screen>
  if (state.status === 'ready') {
    if (!state.me.consentsUpToDate) return <ConsentPanel />
    return <>{children(state.me)}</>
  }
  return <>{children(null)}</>
}
