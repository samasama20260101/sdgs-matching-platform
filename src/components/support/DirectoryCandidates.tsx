'use client'

// 支援団体の申し込みで、前もって載せている団体(掲載台帳)から名前の近い団体を「この団体でしょうか」と出す(#140、2026-11-19 定例)。
// 選んだ団体は申し込みに残し、運営が承認したときに、載せていた情報を申し込みの内容に合わせる。選ばなければ新しい団体として申し込む。
// 入力が止まってから探す(1 文字ずつ API を呼ばない)。名前が変わって候補から外れた団体は、選んでいないものとして扱う
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { Card, cx, Tip } from '@/components/app/ui'

export type ClaimCandidate = {
  id: string
  name: string
  prefectureCode: string | null
  prefectureNameLocal: string | null
  prefectureNameEn: string | null
  website: string | null
  attribution: string | null
  sourceUrl: string
}

const SEARCH_DELAY_MS = 400

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

// 名前(と法人番号)から候補を探す。2 文字に満たない名前で法人番号もなければ探さない
export function useClaimCandidates(name: string, corporateNumber: string | null) {
  const query = useDebounced(`${name.trim()}\u0000${corporateNumber ?? ''}`, SEARCH_DELAY_MS)
  const fetcher = useCallback(() => {
    const [n, c] = query.split('\u0000')
    if ((n ?? '').length < 2 && !c) return Promise.resolve([] as ClaimCandidate[])
    const params = new URLSearchParams({ name: n ?? '' })
    if (c) params.set('corporateNumber', c)
    return apiFetch<{ candidates: ClaimCandidate[] }>(`/api/support/directory-candidates?${params.toString()}`).then((d) => d.candidates)
  }, [query])
  const { data, reload } = useLoad(fetcher)
  return { candidates: data ?? [], reload }
}

export function DirectoryCandidates({ candidates, selected, onSelect }: { candidates: ClaimCandidate[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const t = useTranslations('support.join')
  const locale = useLocale()
  if (candidates.length === 0) return null
  const option = (on: boolean, onClick: () => void, body: ReactNode) => (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={cx('flex min-h-[48px] flex-1 flex-col items-start justify-center gap-0.5 rounded-tool px-3 py-2 text-left', on ? 'border-2 border-night bg-lamp-soft text-ink' : 'border-[1.5px] border-line-strong bg-paper text-ink-soft')}>
      {body}
    </button>
  )
  // 出典は一覧の下に 1 回だけ(PDL1.0・CC BY の表記の義務。相談の画面の提案と同じ)
  const sources = [...new Map(candidates.map((c) => [c.attribution ?? c.sourceUrl, c])).values()]
  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-t14_5 font-bold">{t('claimTitle')}</span>
        <Tip label={t('claimTipLabel')}>{t('claimTip')}</Tip>
      </div>
      <div role="radiogroup" aria-label={t('claimTitle')} className="flex flex-col gap-2">
        {candidates.map((c) => {
          const prefecture = locale === 'ja' ? c.prefectureNameLocal : c.prefectureNameEn
          return (
            <div key={c.id} className="flex items-stretch gap-2">
              {option(selected === c.id, () => onSelect(c.id), (
                <>
                  <span className="text-t14 font-bold">{c.name}</span>
                  {prefecture && <span className="text-t12_5 text-mist">{prefecture}</span>}
                </>
              ))}
              {/* サイトは選ぶボタンの外に置く(リンクを押して、選んだことにならないように) */}
              {c.website && (
                <a href={c.website} target="_blank" rel="noopener noreferrer" aria-label={t('claimSiteLabel', { name: c.name })} className="inline-flex min-h-[48px] min-w-[56px] items-center justify-center text-t12_5 font-bold text-night">
                  {t('claimSite')}
                </a>
              )}
            </div>
          )
        })}
        <div className="flex">{option(selected === null, () => onSelect(null), <span className="text-t14 font-bold">{t('claimNone')}</span>)}</div>
      </div>
      <p className="m-0 text-t11 leading-[1.6] text-mist">
        {sources.map((s, i) => (
          <span key={s.id}>
            {i > 0 && ' ／ '}
            {s.attribution?.startsWith('出典') ? '' : `${t('claimSource')}: `}
            <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-mist">{s.attribution ?? s.sourceUrl}</a>
          </span>
        ))}
      </p>
    </Card>
  )
}
