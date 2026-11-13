// 支え手と団体(公開・ログイン不要)。サーバーで読み、載せる決まりと集計は src/lib/server/publicSupporters.ts の 1 か所だけ。
// 見ている人の地域を先に並べるのと種類の絞り込みは、ブラウザ側(SupporterList)で行う
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { AppHeader } from '@/components/app/AppShell'
import { Footer } from '@/components/app/Footer'
import { ErrorNote, Heading, Lead, Screen } from '@/components/app/ui'
import { SupporterList, type SupporterCardData } from '@/components/supporters/SupporterList'
import { listPublicSupporters } from '@/lib/server/publicSupporters'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'app.supporters' })
  return { title: `${t('title')} | 明日もsamasama`, description: t('lead') }
}

export default async function SupportersPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'app.supporters' })

  let supporters: SupporterCardData[] | null = null
  try {
    supporters = (await listPublicSupporters({ limit: 100 })).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.supporterType,
      nationwide: s.nationwide,
      areas: s.areas.map((a) => ({ region_code: a.region_code, name_local: a.name_local, name_en: a.name_en })),
      resolvedCount: s.resolvedCount,
      thanksCount: s.badgeCount,
    }))
  } catch (error) {
    console.error('[supporters]', error)
  }

  return (
    <Screen>
      <AppHeader />
      <main className="flex flex-col gap-4 pb-6">
        <div className="flex flex-col gap-2 px-1 pt-1">
          <Heading>{t('title')}</Heading>
          <Lead>
            {t('lead')}
            {supporters && supporters.length > 0 && <span className="ml-1 whitespace-nowrap font-bold text-night">{t('count', { count: supporters.length })}</span>}
          </Lead>
        </div>

        {supporters ? <SupporterList supporters={supporters} /> : <ErrorNote>{t('loadFailed')}</ErrorNote>}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/consult/new" className="flex min-h-[56px] items-center justify-center rounded-[16px] bg-night px-4 text-t15 font-bold tracking-[0.2em] text-white no-underline">
            {t('consultCta')}
          </Link>
          <div className="flex flex-col gap-2 rounded-[16px] bg-dawn-soft p-4 text-dawn-ink">
            <span className="text-t14_5 font-bold">{t('joinTitle')}</span>
            <span className="text-t12_5 leading-[1.7]">{t('joinBody')}</span>
            <Link href="/support/join" className="flex min-h-[44px] items-center justify-center rounded-[14px] border-[1.5px] border-current px-3 text-t13_5 font-bold tracking-[0.2em] text-dawn-ink no-underline">
              {t('joinCta')}
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    </Screen>
  )
}
