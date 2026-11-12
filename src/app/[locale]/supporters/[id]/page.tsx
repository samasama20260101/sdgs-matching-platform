// 団体のページ(公開・ログイン不要)。サーバーで読み、載せる決まりと集計は src/lib/server/publicSupporters.ts の 1 か所だけ。
// 旧 URL(/supporters/{user_id})で来たときは、団体の URL に移す
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link, redirect } from '@/i18n/navigation'
import { AppHeader } from '@/components/app/AppShell'
import { Footer } from '@/components/app/Footer'
import { Card, Chip, Heading, Lead, Screen, SectionLabel } from '@/components/app/ui'
import { isUuid } from '@/lib/api/validation'
import { SUPPORTER_BADGES, type BadgeKey } from '@/lib/constants/sdgs'
import { publicSocialLinks } from '@/lib/domain/publicSupporter'
import { findPublicSupporter, publicThanksWords } from '@/lib/server/publicSupporters'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string; id: string }> }

const isBadgeKey = (key: string): key is BadgeKey => Object.hasOwn(SUPPORTER_BADGES, key)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return {}
  const supporter = await findPublicSupporter(id).catch(() => null)
  if (!supporter) return {}
  return { title: `${supporter.name} | 明日もsamasama`, description: supporter.bio?.slice(0, 120) ?? undefined }
}

export default async function SupporterPage({ params }: PageProps) {
  const { locale, id } = await params
  if (!isUuid(id)) notFound()
  const supporter = await findPublicSupporter(id)
  if (!supporter) notFound()
  if (supporter.id !== id) redirect({ href: `/supporters/${supporter.id}`, locale })

  const [t, tType, tBadge, words] = await Promise.all([
    getTranslations({ locale, namespace: 'app.supporters.detail' }),
    getTranslations({ locale, namespace: 'common.supporterType' }),
    getTranslations({ locale, namespace: 'sdgs.badge' }),
    publicThanksWords(supporter.id),
  ])
  const thanks = Object.entries(words).filter(([key]) => isBadgeKey(key)).sort((a, b) => b[1] - a[1])
  const thanksTotal = thanks.reduce((n, [, c]) => n + c, 0)
  const areaNames = supporter.areas.map((a) => (locale === 'ja' ? a.name_local : a.name_en))
  const links = publicSocialLinks(supporter.socialLinks)
  const since = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'Asia/Tokyo' }).format(new Date(supporter.createdAt))
  const linkLabel = (l: (typeof links)[number]) =>
    l.kind === 'website' ? t('website') : l.kind === 'x' ? l.label || 'X' : l.kind === 'instagram' ? l.label || 'Instagram' : l.kind === 'facebook' ? 'Facebook' : t('line', { id: l.label })

  return (
    <Screen>
      <AppHeader />
      <main className="flex flex-col gap-4 pb-6">
        <Link href="/supporters" className="flex min-h-[40px] items-center self-start text-t13 text-night">← {t('backToList')}</Link>

        <Card className="flex flex-col gap-2.5 p-4">
          <span className="flex flex-wrap items-center gap-1.5">
            <Chip>{tType(supporter.supporterType)}</Chip>
            <span className="text-t12 text-mist">{t('since', { date: since })}</span>
          </span>
          <Heading className="wrap-anywhere">{supporter.name}</Heading>
          {links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-line pt-2.5">
              {links.map((l) =>
                l.href ? (
                  <a key={l.kind} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] max-w-full items-center truncate rounded-full border border-line-strong px-3 text-t12_5 font-bold text-night no-underline">
                    {linkLabel(l)}
                  </a>
                ) : (
                  <span key={l.kind} className="inline-flex min-h-[36px] max-w-full items-center truncate rounded-full bg-kinari-deep px-3 text-t12_5 text-ink-soft">{linkLabel(l)}</span>
                ),
              )}
            </div>
          )}
        </Card>

        <dl className="m-0 grid grid-cols-3 gap-2">
          {[
            { label: t('statResolved'), value: String(supporter.resolvedCount) },
            { label: t('statThanks'), value: String(thanksTotal) },
            { label: t('statAreas'), value: supporter.nationwide ? t('areasNationwide') : String(areaNames.length) },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 rounded-soft border border-line bg-paper px-2 py-3">
              <dd className="m-0 text-t20 font-bold text-night">{s.value}</dd>
              <dt className="text-t11_5 text-mist">{s.label}</dt>
            </div>
          ))}
        </dl>

        {supporter.bio && (
          <Card className="flex flex-col gap-2 p-4">
            <SectionLabel>{t('bioTitle')}</SectionLabel>
            <p className="m-0 whitespace-pre-wrap wrap-anywhere text-t14 leading-[1.8]">{supporter.bio}</p>
          </Card>
        )}

        {(supporter.nationwide || areaNames.length > 0) && (
          <Card className="flex flex-col gap-2 p-4">
            <SectionLabel>{t('areasTitle')}</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {supporter.nationwide ? <Chip color="leaf">{t('areasNationwide')}</Chip> : areaNames.map((n) => <Chip key={n} color="outline">{n}</Chip>)}
            </div>
          </Card>
        )}

        {thanks.length > 0 && (
          <Card className="flex flex-col gap-2 p-4">
            <SectionLabel>{t('thanksTitle')}</SectionLabel>
            <span className="px-1 text-t12 text-mist">{t('thanksLead')}</span>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
              {thanks.map(([key, count]) => (
                <li key={key} className="flex items-center gap-2 rounded-tool bg-lamp-faint px-3 py-2">
                  <span aria-hidden className="text-t18">{SUPPORTER_BADGES[key as BadgeKey].emoji}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-t12_5 font-bold">{tBadge(key)}</span>
                    <span className="text-t11_5 text-mist">{t('thanksCount', { count })}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex flex-col gap-2 rounded-[16px] bg-kinari-deep p-4">
          <span className="text-t14_5 font-bold">{t('ctaTitle')}</span>
          <Lead>{t('ctaBody')}</Lead>
          <Link href="/consult/new" className="flex min-h-[52px] items-center justify-center rounded-[16px] bg-night px-4 text-t15 font-bold tracking-[0.1em] text-white no-underline">
            {t('ctaConsult')}
          </Link>
        </div>
        <Footer />
      </main>
    </Screen>
  )
}
