'use client'

// いま、すぐに話せる窓口(どの画面からも出す。原則 10「行き止まりを作らない」)。
// 日本の番号は日本にいる人にだけ出し、ほかの国の人には住んでいる国の緊急の番号を案内する。
import { useTranslations } from 'next-intl'

export const JP_HOTLINES = [
  { key: 'yorisoi', tel: '0120279338', primary: true },
  { key: 'fire', tel: '119', primary: false },
  { key: 'police', tel: '110', primary: false },
] as const

export function CrisisLinks({ country }: { country?: string | null }) {
  const t = useTranslations('app.crisis')
  const inJapan = !country || country === 'JP'
  return (
    <section aria-label={t('title')} className="flex flex-col gap-2 rounded-[16px] border border-line bg-paper p-3.5">
      <span className="text-[12.5px] font-bold">{t('title')}</span>
      {inJapan ? (
        <div className="flex flex-wrap gap-1.5">
          {JP_HOTLINES.map((h) => (
            <a
              key={h.key}
              href={`tel:${h.tel}`}
              className={h.primary
                // 名前の長い窓口は1行を使い、番号の短い 119・110 は次の行に並べる(360px で名前が折り返さないように)
                ? 'flex min-h-[44px] basis-full items-center justify-center rounded-tool bg-night px-2 text-center text-[13px] font-bold text-white no-underline'
                : 'flex min-h-[44px] flex-1 items-center justify-center rounded-tool border-[1.5px] border-line-strong text-[13px] font-bold text-ink no-underline'}
            >
              {t(`jp.${h.key}`)}
            </a>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[13px] leading-[1.7] text-ink-soft">{t('abroad')}</p>
      )}
    </section>
  )
}
