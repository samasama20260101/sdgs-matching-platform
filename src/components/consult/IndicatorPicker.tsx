'use client'

// 困りごとを選ぶ(盤 12)。大項目ごとに開いて、近いものを3つまで。重い選択肢を選ぶと、その場で窓口を出す
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { indicatorMessageKey, MAX_INDICATOR_SELECTIONS } from '@/lib/constants/intakeIndicators'
import type { IntakeOption } from '@/lib/domain/intake'
import { cx } from '@/components/app/ui'

export function IndicatorPicker({
  options,
  selected,
  onChange,
  translate,
}: {
  options: IntakeOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  // 個人の選択肢は訳がある(messages/<言語>/sdgs.json)。会社・地域の選択肢は代表の表の日本語のまま
  translate: boolean
}) {
  const t = useTranslations('consult.write')
  const tSdgs = useTranslations('sdgs')
  const categories = [...new Set(options.map((o) => o.category))]
  const [open, setOpen] = useState<number | null>(null)
  const full = selected.length >= MAX_INDICATOR_SELECTIONS
  const textOf = (o: IntakeOption) => (translate ? tSdgs(`indicator.${indicatorMessageKey(o.id)}`) : o.text)
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id))
    else if (!full) onChange([...selected, id])
  }
  const byId = new Map(options.map((o) => [o.id, o]))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-tool bg-kinari-deep p-3">
        <span className="text-[12.5px] font-bold text-mist">{t('chosen', { count: selected.length, max: MAX_INDICATOR_SELECTIONS })}</span>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((id) => {
              const o = byId.get(id)
              if (!o) return null
              const text = textOf(o)
              return (
                <button key={id} type="button" onClick={() => toggle(id)} aria-label={t('remove', { text })} className="flex items-center gap-1 rounded-full bg-lamp-soft px-3 py-1 text-[12.5px] font-bold">
                  {text.length > 16 ? `${text.slice(0, 16)}…` : text}<span aria-hidden>×</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {categories.map((cat) => {
          const items = options.filter((o) => o.category === cat)
          const picked = items.filter((o) => selected.includes(o.id)).length
          const isOpen = open === cat
          return (
            <li key={cat} className="overflow-hidden rounded-[16px] border border-line bg-paper">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : cat)} className="flex min-h-[52px] w-full items-center justify-between gap-2 px-4 text-left">
                <span className="text-[15px] font-bold">{tSdgs(`category.${cat}`)}</span>
                <span className="flex items-center gap-2">
                  {picked > 0 && <span className="rounded-full bg-night px-2 py-0.5 text-[11.5px] font-bold text-white">{t('pickedCount', { count: picked })}</span>}
                  <span aria-hidden className={cx('transition-transform', isOpen && 'rotate-180')}>⌄</span>
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1.5 px-3 pb-3">
                  {items.map((o) => {
                    const on = selected.includes(o.id)
                    const disabled = !on && full
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        disabled={disabled}
                        onClick={() => toggle(o.id)}
                        className={cx(
                          'flex min-h-[48px] items-start gap-3 rounded-tool px-3 py-2.5 text-left text-[14px] leading-[1.6]',
                          on ? 'border-2 border-night bg-lamp-soft' : 'border border-line bg-paper',
                          disabled && 'bg-kinari-deep text-mist',
                        )}
                      >
                        <span aria-hidden className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[12px] text-white', on ? 'bg-night' : 'border-[1.5px] border-mist-light bg-paper')}>{on ? '✓' : ''}</span>
                        {textOf(o)}
                      </button>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// 書いた内容から出した「近いもの」(盤 12b)。押すと選ぶ・外す。3つ選ぶと、ほかは押せない
export function SuggestedOptions({
  ids,
  selected,
  onToggle,
  textOf,
}: {
  ids: string[]
  selected: string[]
  onToggle: (id: string) => void
  textOf: (id: string) => string
}) {
  if (ids.length === 0) return null
  const full = selected.length >= MAX_INDICATOR_SELECTIONS
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {ids.map((id) => {
        const on = selected.includes(id)
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onToggle(id)}
              className={cx('flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-2 text-left text-[14.5px] leading-[1.6]', on ? 'border-night bg-lamp-soft font-bold' : 'border-line bg-paper disabled:text-mist')}
            >
              <span>{textOf(id)}</span>
              <span aria-hidden className="shrink-0">{on ? '✓' : '＋'}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
