'use client'

// 支え手と団体の一覧(公開)。データはサーバーで読み、ここでは見ている人の地域を先に並べることと、種類の絞り込みだけをする
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useReadyMe } from '@/components/app/SessionProvider'
import { Chip, cx } from '@/components/app/ui'
import { regionFirst, type PublicSupporterType } from '@/lib/domain/publicSupporter'

export type SupporterCardData = {
  id: string
  name: string
  type: PublicSupporterType
  nationwide: boolean
  areas: { region_code: string; name_local: string; name_en: string }[]
  resolvedCount: number
  thanksCount: number
}

const TYPES: PublicSupporterType[] = ['NPO', 'CORPORATE', 'GOVERNMENT', 'OTHER']
const PAGE = 20

export function SupporterList({ supporters }: { supporters: SupporterCardData[] }) {
  const t = useTranslations('app.supporters')
  const tType = useTranslations('common.supporterType')
  const locale = useLocale()
  const me = useReadyMe()
  const [type, setType] = useState<PublicSupporterType | null>(null)
  const [shown, setShown] = useState(PAGE)

  const { items, matched } = regionFirst(supporters, me?.person.regionCode ?? null)
  const filtered = type ? items.filter((s) => s.type === type) : items
  const areaName = (a: SupporterCardData['areas'][number]) => (locale === 'ja' ? a.name_local : a.name_en)

  if (supporters.length === 0) return <p className="m-0 px-1 text-t13_5 text-mist">{t('emptyAll')}</p>

  return (
    <div className="flex flex-col gap-3">
      {matched.size > 0 && (
        <p className="m-0 rounded-tool bg-lamp-faint px-3 py-2 text-t12_5 font-bold text-ink-soft">{t('regionFirst', { count: matched.size })}</p>
      )}
      <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-1.5">
        {[null, ...TYPES].map((key) => (
          <button
            key={key ?? 'all'}
            type="button"
            aria-pressed={type === key}
            onClick={() => { setType(key); setShown(PAGE) }}
            className={cx('min-h-[40px] whitespace-nowrap rounded-full border px-3.5 text-t13 font-bold', type === key ? 'border-night bg-night text-white' : 'border-line bg-paper text-ink-soft')}
          >
            {key ? tType(key) : t('filterAll')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="m-0 px-1 text-t13_5 text-mist">{t('empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {filtered.slice(0, shown).map((s) => {
            const areas = s.nationwide ? [t('nationwide')] : s.areas.slice(0, 3).map(areaName)
            const more = s.nationwide ? 0 : Math.max(0, s.areas.length - 3)
            return (
              <li key={s.id}>
                <Link href={`/supporters/${s.id}`} className={cx('flex flex-col gap-1.5 rounded-soft border bg-paper p-4 text-ink no-underline', matched.has(s) ? 'border-night' : 'border-line')}>
                  <span className="line-clamp-2 wrap-anywhere text-t15 font-bold leading-[1.5]" title={s.name}>{s.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip>{tType(s.type)}</Chip>
                    {matched.has(s) && <Chip color="lamp">{t('regionChip')}</Chip>}
                  </span>
                  {areas.length > 0 && (
                    <span className="text-t12_5 text-ink-soft">{areas.join(' · ')}{more > 0 && ` ${t('othersSuffix', { count: more })}`}</span>
                  )}
                  <span className="flex gap-3 border-t border-line pt-2 text-t12 text-mist">
                    <span>{t('resolved', { count: s.resolvedCount })}</span>
                    <span>{t('thanks', { count: s.thanksCount })}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {filtered.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-[44px] self-center text-t13_5 font-bold text-night underline">
          {t('showMore', { count: filtered.length - shown })}
        </button>
      )}
    </div>
  )
}
