'use client'

// 入口(盤 10)。だれの困りごとかを選んでもらう。ログインしていれば、その人のホームへ
import { Suspense, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { useSession } from '@/components/app/SessionProvider'
import { AppHeader } from '@/components/app/AppShell'
import { CrisisLinks } from '@/components/app/CrisisLinks'
import { Footer } from '@/components/app/Footer'
import { Heading, Lead, Screen, SectionLabel } from '@/components/app/ui'

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-lamp)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
  )
}

function EntryInner() {
  const t = useTranslations('app.entry')
  const { state, mode } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  // 本屋などの相談所の QR から来たとき(相談所コード)。コードは相談を書く画面まで持っていき、相談に記録する
  const shop = params.get('shop')

  useEffect(() => {
    if (state.status === 'ready' && !shop) {
      router.replace(state.me.person.role === 'ADMIN' ? '/admin' : mode === 'support' ? '/support' : '/home')
    }
  }, [state, mode, router, shop])

  const withShop = (path: string) => (shop ? `${path}${path.includes('?') ? '&' : '?'}shop=${encodeURIComponent(shop)}` : path)

  return (
    <Screen>
      <AppHeader />
      <main className="flex flex-col gap-3 pb-6">
        {shop && (
          <span className="self-start rounded-full border border-line bg-paper px-3 py-1 text-t12 text-ink-soft">{t('fromShop')}</span>
        )}
        <div className="flex flex-col gap-2 px-1 pt-1">
          <Heading>{t.rich('title', { br: () => <br /> })}</Heading>
          <Lead>{t('lead')}</Lead>
        </div>

        <SectionLabel>{t('whose')}</SectionLabel>
        <nav aria-label={t('entriesLabel')} className="flex flex-col gap-2">
          <Link href={withShop('/consult/new')} className="flex min-h-[64px] items-center gap-3.5 rounded-[18px] bg-night px-4 py-2.5 text-white no-underline">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lamp" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-t16 font-bold">{t('mine')}</span>
              <span className="text-t12 text-[#C9D6E6]">{t('mineNote')}</span>
            </span>
            <Chevron />
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href={withShop('/consult/org?subject=COMPANY')} className="flex min-h-[60px] flex-col justify-center gap-0.5 rounded-[16px] border border-line bg-paper px-3.5 py-2.5 text-ink no-underline">
              <span className="text-t14_5 font-bold">{t('company')}</span>
              <span className="text-t11_5 text-mist">{t('companyNote')}</span>
            </Link>
            <Link href={withShop('/consult/org?subject=COMMUNITY')} className="flex min-h-[60px] flex-col justify-center gap-0.5 rounded-[16px] border border-line bg-paper px-3.5 py-2.5 text-ink no-underline">
              <span className="text-t14_5 font-bold">{t('community')}</span>
              <span className="text-t11_5 text-mist">{t('communityNote')}</span>
            </Link>
          </div>
        </nav>

        <SectionLabel>{t('besides')}</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/support/join" className="flex min-h-[72px] flex-col justify-center gap-1 rounded-[16px] bg-dawn-soft px-3.5 py-3 text-dawn-ink no-underline">
            <span className="text-t14_5 font-bold">{t('becomeSupporter')}</span>
            <span className="text-t11_5 leading-[1.5]">{t('becomeSupporterNote')}</span>
          </Link>
          <Link href="/learn" className="flex min-h-[72px] flex-col justify-center gap-1 rounded-[16px] bg-leaf-soft px-3.5 py-3 text-leaf-ink no-underline">
            <span className="text-t14_5 font-bold">{t('learn')}</span>
            <span className="text-t11_5 leading-[1.5]">{t('learnNote')}</span>
          </Link>
        </div>

        <Link href="/trial" className="flex min-h-[40px] items-center self-center text-t13 text-night">{t('trial')}</Link>

        <CrisisLinks />
        <Footer />
      </main>
    </Screen>
  )
}

export default function EntryPage() {
  return (
    <Suspense fallback={null}>
      <EntryInner />
    </Suspense>
  )
}
