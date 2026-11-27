'use client'

// 相談がまだないときに、相談者のホームとやりとりに出すもの(#177。2026-11-28 に決めたキャンバスの「決定案」)。
// キャンバス: https://claude.ai/artifact/EHkSSxiUZ9AFBYvUD7MSsm 。相談が 1 件でもあれば出さない(常に出る説明文は #170 で減らした)
// 団体とお知らせはサーバーで読んで渡す(公開の一覧と同じ決まりのものだけ)
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card } from '@/components/app/ui'
import { LineIcon, TomoshibiDot } from '@/components/app/LineIcon'
import { NamiaGlow } from '@/components/app/NamiaGlow'
import { homeSupporterTiles } from '@/lib/domain/emptyStates'
import { SupporterAvatar } from '@/components/supporters/SupporterAvatar'
import type { PublicSupporterType } from '@/lib/domain/publicSupporter'
import type { NewsCategory } from '@/lib/constants/news'
import { formatNewsDate } from '@/lib/news/format'

export type EmptyStateSupporter = {
  id: string
  name: string
  type: PublicSupporterType
  photoUrl: string | null
  nationwide: boolean
  areas: { region_code: string; name_local: string; name_en: string }[]
}

export type EmptyStateNews = { id: string; title: string; category: NewsCategory; publishedAt: string }

const STEPS = [1, 2, 3] as const

// 相談すると、こう進みます(3 段)。3 段目の丸だけ灯の色(相手と話せたところが灯)
export function HowItGoes() {
  const t = useTranslations('app.home.flow')
  return (
    <section aria-labelledby="home-flow-title" className="relative flex flex-col gap-2.5 rounded-soft border border-line bg-paper px-[18px] py-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- Workers では next/image の最適化を使わない */}
      <img src="/namia.webp" alt="" width={52} height={70} className="pointer-events-none absolute -top-[18px] right-3.5 h-[70px] w-[52px] object-contain" />
      <h2 id="home-flow-title" className="m-0 pr-14 text-t15 font-bold">{t('title')}</h2>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {STEPS.map((n) => (
          <li key={n} className="flex items-start gap-3">
            <span aria-hidden className={n === 3 ? 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-night bg-tomoshibi text-t12_5 font-bold text-night' : 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-night text-t12_5 font-bold text-night'}>{n}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-t14 font-bold">{t(`step${n}`)}</span>
              <span className="text-balance text-t12 leading-[1.6] text-mist [word-break:auto-phrase]">{t(`step${n}Note`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// 相談を受けている支援団体(見ている人の地域を先に 2 つ)。写真がない団体は頭文字(#178)
export function SupporterTiles({ supporters, regionCode }: { supporters: EmptyStateSupporter[]; regionCode: string | null }) {
  const t = useTranslations('app.home.empty')
  const tList = useTranslations('app.supporters')
  const tType = useTranslations('common.supporterType')
  const locale = useLocale()
  const tiles = homeSupporterTiles(supporters, regionCode)
  if (tiles.length === 0) return null
  const areaOf = (s: EmptyStateSupporter) => {
    if (s.nationwide) return tList('nationwide')
    const first = s.areas[0]
    if (!first) return null
    const name = locale === 'ja' ? first.name_local : first.name_en
    return s.areas.length > 1 ? `${name} ${tList('othersSuffix', { count: s.areas.length - 1 })}` : name
  }
  return (
    <section aria-labelledby="home-supporters-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="home-supporters-title" className="m-0 text-t12_5 font-bold text-mist">{t('supporters')}</h2>
        <Link href="/supporters" className="text-t12_5 font-bold text-night no-underline">{t('seeAll')} ›</Link>
      </div>
      {tiles.map((s) => {
        const area = areaOf(s)
        return (
          <Link key={s.id} href={`/supporters/${s.id}`} className="no-underline">
            <Card className="flex items-center gap-3 px-3.5 py-3 text-ink">
              <SupporterAvatar name={s.name} photoUrl={s.photoUrl} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-t14 font-bold">{s.name}</span>
                <span className="truncate text-t12 text-mist">{area ? `${tType(s.type)} ・ ${area}` : tType(s.type)}</span>
              </span>
            </Card>
          </Link>
        )
      })}
    </section>
  )
}

function MoreNewsLink() {
  const t = useTranslations('app.home.empty')
  return <Link href="/news" className="self-center text-t13 font-bold text-night no-underline">{t('moreNews')} ›</Link>
}

// お知らせ(新しい順に 2 件)と「お知らせをもっと見る」
export function NewsPreview({ news }: { news: EmptyStateNews[] }) {
  const t = useTranslations('app.home.empty')
  const locale = useLocale()
  if (news.length === 0) return null
  return (
    <section aria-labelledby="home-news-title" className="flex flex-col gap-2">
      <h2 id="home-news-title" className="m-0 px-1 text-t12_5 font-bold text-mist">{t('news')}</h2>
      <Card className="flex flex-col overflow-hidden">
        {news.map((n, i) => (
          <Link key={n.id} href={`/news/${n.id}`} className={i > 0 ? 'flex flex-col gap-0.5 border-t border-line px-3.5 py-3 text-ink no-underline hover:bg-kinari-deep' : 'flex flex-col gap-0.5 px-3.5 py-3 text-ink no-underline hover:bg-kinari-deep'}>
            <time dateTime={n.publishedAt} className="text-t11_5 text-mist">{formatNewsDate(n.publishedAt, locale)}</time>
            <span className="text-t13_5 font-bold leading-[1.55]">{n.title}</span>
          </Link>
        ))}
      </Card>
      <MoreNewsLink />
    </section>
  )
}

// やりとり: 支援中・解決した相談がないとき。ナミアと灯の印の見本、相談を書く、支援の現場から(新しいインタビュー)
export function EmptyTalk({ interview }: { interview: EmptyStateNews | null }) {
  const t = useTranslations('consult.talk.emptyState')
  const tHome = useTranslations('app.home')
  const tCategory = useTranslations('landing.news.category')
  const locale = useLocale()
  return (
    <>
      <section className="mt-4 flex flex-col items-center gap-3 px-4 text-center">
        <NamiaGlow size={104} alt={t('namiaAlt')} />
        <h3 className="m-0 mt-1.5 text-t17 font-bold">{t('title')}</h3>
        <p className="m-0 text-balance text-t13_5 leading-[1.8] text-mist [word-break:auto-phrase]">{t('body')}</p>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2 text-t13 font-bold text-night">
          <TomoshibiDot />
          {tHome('turnReply')}
        </span>
        <Link href="/consult/new" className="mt-1.5 flex min-h-[52px] min-w-[220px] items-center justify-center rounded-[16px] bg-lamp px-6 text-t15 font-bold btn-track text-ink no-underline">
          {tHome('write')}
        </Link>
      </section>
      {interview && (
        <section aria-labelledby="talk-field-title" className="mt-3 flex flex-col gap-2">
          <h3 id="talk-field-title" className="m-0 px-1 text-t12_5 font-bold text-mist">{t('field')}</h3>
          <Link href={`/news/${interview.id}`} className="no-underline">
            <Card className="flex items-center gap-3 px-3.5 py-3 text-ink">
              <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] bg-lamp-faint text-night">
                <LineIcon name="learn" lit size={28} />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-t11_5 text-mist">{tCategory(interview.category)} ・ {formatNewsDate(interview.publishedAt, locale)}</span>
                <span className="text-t13_5 font-bold leading-[1.55]">{interview.title}</span>
              </span>
            </Card>
          </Link>
        </section>
      )}
      <MoreNewsLink />
    </>
  )
}

