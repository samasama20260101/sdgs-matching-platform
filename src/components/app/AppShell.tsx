'use client'

// 画面の枠(盤 04): 上のヘッダー(相談する / 支える の切り替え・相談する側だけ「いますぐ話したい」)と下のタブ。
// いますぐの窓口は、印でなく言葉のボタンで相談する側の全画面に置く(11/5 岡本さん。他社と英国政府の設計の決まりに合わせる)
// 相談する: ホーム・やりとり・知る・わたし / 支える: ホーム・さがす・やりとり・わたし
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher'
import { CrisisLinks } from './CrisisLinks'
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
    <div role="tablist" aria-label={t('modeLabel')} className="flex rounded-full bg-steel p-0.5 text-[12.5px] font-bold">
      {(['consult', 'support'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => pick(m)}
          className={cx('min-h-[36px] whitespace-nowrap rounded-full px-3', mode === m ? 'bg-night text-white' : 'text-ink-soft')}
        >
          {t(`mode.${m}`)}
        </button>
      ))}
    </div>
  )
}

export function AppHeader() {
  const t = useTranslations('app.shell')
  const { state, canSupport, mode } = useSession()
  const pathname = usePathname()
  const [crisisOpen, setCrisisOpen] = useState(false)
  const country = state.status === 'ready' ? state.me.person.country : null
  // ログインしたあとの相談する側の画面だけに出す(入口と相談を書く画面には、窓口がもう出ている)
  const showCrisis = state.status === 'ready' && state.me.person.role !== 'ADMIN' && mode === 'consult'
  return (
    <>
      <header className="flex h-14 items-center justify-between gap-2">
        <Link href={state.status === 'ready' ? '/home' : '/'} className="flex items-center gap-2.5 text-ink no-underline">
          <Mark />
          {/* 切り替えが出る人は、スマホの幅では名前を印だけにする(390px で名前と切り替えが折り返す) */}
          <span className={cx('whitespace-nowrap font-heading text-[16px] font-bold', canSupport && 'max-sm:sr-only')}>{t('brand')}</span>
        </Link>
        <div className="flex items-center gap-1">
          {canSupport && <ModeSwitch />}
          {state.status === 'anonymous' && (
            <>
              <LanguageSwitcher />
              {pathname !== '/start' && (
                <Link href="/start" className="flex min-h-[44px] items-center px-2.5 text-[13px] font-bold text-night no-underline">
                  {t('login')}
                </Link>
              )}
            </>
          )}
          {showCrisis && (
            <button
              type="button"
              aria-expanded={crisisOpen}
              onClick={() => setCrisisOpen((v) => !v)}
              className="flex min-h-[44px] items-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-bold text-coral-ink"
            >
              {t('crisisNow')}
            </button>
          )}
        </div>
      </header>
      {showCrisis && crisisOpen && <div className="mb-3"><CrisisLinks country={country} /></div>}
    </>
  )
}

const CONSULT_TABS = [
  { key: 'home', href: '/home' },
  { key: 'talk', href: '/talk' },
  { key: 'learn', href: '/learn' },
  { key: 'me', href: '/me' },
] as const

const SUPPORT_TABS = [
  { key: 'home', href: '/support' },
  { key: 'find', href: '/support/find' },
  { key: 'talk', href: '/support/talk' },
  { key: 'me', href: '/me' },
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
        {tabs.map((tab) => (
          <li key={tab.key} className="flex-1">
            <Link
              href={tab.href}
              aria-current={active(tab.href) ? 'page' : undefined}
              className={cx('flex min-h-[56px] flex-col items-center justify-center text-[12px] font-bold no-underline', active(tab.href) ? 'text-night' : 'text-mist')}
            >
              <span className={cx('mb-1 h-1 w-6 rounded-full', active(tab.href) ? 'bg-lamp' : 'bg-transparent')} aria-hidden />
              {t(tab.key)}
            </Link>
          </li>
        ))}
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
