'use client'

// ログインとはじめの質問が済んだ人だけに中身を出す。済んでいなければ /start へ案内する
import { useEffect, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useSession, useReadyMe } from './SessionProvider'
import { Button, Lead, Screen, Spinner } from './ui'
import { ConsentPanel } from './ConsentPanel'

type ReadyMe = NonNullable<ReturnType<typeof useReadyMe>>

export function RequireMe({ children, admin = false }: { children: (me: ReadyMe) => ReactNode; admin?: boolean }) {
  const { state, signOut } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('app.gate')

  const isAdmin = state.status === 'ready' && state.me.person.role === 'ADMIN'
  useEffect(() => {
    if (state.status === 'anonymous' || state.status === 'needsOnboarding') {
      router.replace(`/start?next=${encodeURIComponent(pathname)}`)
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
