'use client'

// 画面の枠(盤 04): 上のヘッダー(相談する / 支える の切り替え)と下のタブ。
// よりそいホットライン・119・110 の「いますぐ話したい」は置かない(2026-11-23 代表の要望で外した。#160)
// 相談する: ホーム・やりとり・知る・わたし / 支える: ホーム・さがす・やりとり・わたし
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher'
import { LineIcon } from './LineIcon'
import { Mark } from './Mark'
import { useSession, type Mode } from './SessionProvider'
import { cx, Screen, type Tone } from './ui'

function ModeSwitch() {
  const t = useTranslations('app.shell')
  const { mode, setMode } = useSession()
  const router = useRouter()
  const pick = (next: Mode) => {
    setMode(next)
    router.push(next === 'support' ? '/support' : '/home')
  }
  return (
    <div role="tablist" aria-label={t('modeLabel')} className="flex rounded-full bg-steel p-0.5 text-t12_5 font-bold">
      {(['consult', 'support'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => pick(m)}
          className={cx('min-h-[36px] whitespace-nowrap rounded-full px-2.5', mode === m ? 'bg-night text-white' : 'text-ink-soft')}
        >
          {t(`mode.${m}`)}
        </button>
      ))}
    </div>
  )
}

export function AppHeader() {
  const t = useTranslations('app.shell')
  const { state, canSupport } = useSession()
  const pathname = usePathname()
  // ログインする前に相談を書いている(相談は先に書き、届けるときにログインする。2026-11-17)
  const writingBeforeLogin = (state.status === 'anonymous' || state.status === 'needsOnboarding') && pathname.startsWith('/consult')
  return (
    <header className="flex h-14 items-center justify-between gap-2">
      <Link href={state.status === 'ready' ? '/home' : '/'} className="flex shrink-0 items-center gap-2.5 text-ink no-underline">
        <Mark />
        {/* 切り替えが出る人は、スマホの幅では名前を印だけにする(390px で名前と切り替えが折り返す) */}
        <span className={cx('whitespace-nowrap font-logo text-t16 font-bold', canSupport && 'max-sm:sr-only')}>{t('brand')}</span>
      </Link>
      <div className="flex min-w-0 items-center gap-1">
        {canSupport && <ModeSwitch />}
        {state.status === 'anonymous' && (
          <>
            <LanguageSwitcher />
            {/* 相談を書いている途中は出さない(ここから入ると書いた内容を預けずにホームへ進む。ログインは届けるボタンから) */}
            {pathname !== '/start' && !writingBeforeLogin && (
              <Link href="/start" className="flex min-h-[44px] items-center px-2.5 text-t13 font-bold text-night no-underline">
                {t('login')}
              </Link>
            )}
          </>
        )}
      </div>
    </header>
  )
}

// アイコンはまるい線で、選んでいるタブだけ黄色の灯がともる(#171、2026-11-27 岡本さんが案C の黄色に決定)
const CONSULT_TABS = [
  { key: 'home', href: '/home', icon: 'home' },
  { key: 'talk', href: '/talk', icon: 'talk' },
  { key: 'learn', href: '/learn', icon: 'learn' },
  { key: 'me', href: '/me', icon: 'me' },
] as const

const SUPPORT_TABS = [
  { key: 'home', href: '/support', icon: 'home' },
  { key: 'find', href: '/support/find', icon: 'find' },
  { key: 'talk', href: '/support/talk', icon: 'talk' },
  { key: 'me', href: '/me', icon: 'me' },
] as const

export function BottomTabs() {
  const t = useTranslations('app.tabs')
  const { mode, state } = useSession()
  const pathname = usePathname()
  if (state.status !== 'ready' || state.me.person.role === 'ADMIN') return null
  const tabs = mode === 'support' ? SUPPORT_TABS : CONSULT_TABS
  const active = (href: string) => (href === '/support' || href === '/home' ? pathname === href : pathname.startsWith(href))
  return (
    <nav aria-label={t('label')} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur">
      <ul className="mx-auto flex max-w-[560px] justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const on = active(tab.href)
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={on ? 'page' : undefined}
                className={cx('flex min-h-[60px] flex-col items-center justify-center gap-[3px] text-t12 font-bold no-underline', on ? 'text-night' : 'text-mist')}
              >
                <LineIcon name={tab.icon} lit={on} />
                {t(tab.key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function AppFrame({ tone, children, tabs = true }: { tone?: Tone; children: ReactNode; tabs?: boolean }) {
  const { mode } = useSession()
  return (
    <Screen tone={tone ?? (mode === 'support' ? 'support' : 'consult')}>
      <AppHeader />
      <main className="flex flex-col gap-3">{children}</main>
      {tabs && <BottomTabs />}
    </Screen>
  )
}
