'use client'

// 相談に合いそうな支援団体(#138、盤 13 の置き換え)。届けた相談の内容から 3 つまで選んだものを出す。
// 運営が伝えてよいかは本人が選ぶ。緊急と判定した相談では、AI が選んだ全国の電話窓口が入ることがある
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { Card, Chip, Tip } from '@/components/app/ui'

type Suggestion = {
  id: string
  kind: string
  name: string
  reason: string | null
  channels: string[]
  phone: string | null
  website: string | null
  hours: string | null
  unregistered: boolean
  canShare: boolean
  // 全国の団体、または相談者と違う都道府県の団体(name はその都道府県)。同じ都道府県なら null
  area: { kind: 'NATIONWIDE' } | { kind: 'OTHER_PREFECTURE'; name: string | null } | null
  attribution: string | null
  sourceUrl: string
}

type Data = { pending: boolean; suggestions: Suggestion[] }

// 届けた直後は提案を作っている途中なので、少しずつ間を空けて読み直す
const POLL_MS = 4_000
const POLL_MAX = 12

export function Referrals({ caseId, canDecide, consented }: { caseId: string; canDecide: boolean; consented: string[] }) {
  const t = useTranslations('consult.referrals')
  const fetcher = useCallback(() => apiFetch<Data>(`/api/cases/${caseId}/referrals`), [caseId])
  const { data, reload } = useLoad(fetcher)
  const [polls, setPolls] = useState(0)
  const [agreed, setAgreed] = useState<Set<string>>(new Set(consented))
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!data?.pending || polls >= POLL_MAX) return
    const timer = setTimeout(() => {
      setPolls((n) => n + 1)
      void reload()
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [data, polls, reload])

  const consent = async (entryId: string) => {
    setBusyId(entryId)
    try {
      await apiFetch(`/api/cases/${caseId}/referrals`, { method: 'POST', json: { entryId } })
      setAgreed((s) => new Set([...s, entryId]))
    } finally {
      setBusyId(null)
    }
  }

  if (!data) return null
  const action = 'inline-flex min-h-[44px] items-center text-t13 font-bold text-night no-underline'
  const sourcesOf = (entries: { id: string; attribution: string | null; sourceUrl: string }[]) => [...new Map(entries.map((e) => [e.attribution ?? e.sourceUrl, e])).values()]
  // 出典は札ごとに出さず、一覧の下に1回だけまとめる(PDL1.0・CC BY の表記の義務は一覧の単位で満たす)
  const sourceLine = (entries: { id: string; attribution: string | null; sourceUrl: string }[]) => (
    <p className="m-0 px-1 text-t11 leading-[1.6] text-mist">
      {sourcesOf(entries).map((e, i) => (
        <span key={e.id}>
          {i > 0 && ' ／ '}
          {/* 表記が「出典」で始まるものはそのまま出す */}
          {e.attribution?.startsWith('出典') ? '' : `${t('source')}: `}
          <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-mist">{e.attribution ?? e.sourceUrl}</a>
        </span>
      ))}
    </p>
  )

  const header = (
    <div className="flex items-center justify-between px-1">
      <span className="text-t15 font-bold">{t('title')}</span>
      <Tip label={t('tipLabel')}>{t('tip')}</Tip>
    </div>
  )

  if (data.pending) {
    if (polls >= POLL_MAX) return null
    return (
      <section className="flex flex-col gap-2">
        {header}
        <Card className="px-3.5 py-3"><span className="text-t13 text-mist">{t('pending')}</span></Card>
      </section>
    )
  }
  if (data.suggestions.length === 0) return null

  // 札は名前・理由・相談の手段と、できること(電話する・サイトを見る・運営から伝えてもらう)だけにする
  const render = (e: Suggestion) => (
    <Card key={e.id} className="flex flex-col gap-1.5 px-3.5 pb-1 pt-3">
      <span className="flex items-start justify-between gap-2">
        <span className="text-t14_5 font-bold leading-[1.5]">{e.name}</span>
        <Chip className="shrink-0 whitespace-nowrap">{e.kind === 'ORGANIZATION' ? t('organization') : t('public')}</Chip>
      </span>
      {e.reason && <span className="text-t13 leading-[1.6] text-ink-soft">{e.reason}</span>}
      {(e.area || e.channels.length > 0) && (
        <span className="flex flex-wrap gap-1">
          {e.area && (
            <Chip color="dawn">
              {e.area.kind === 'NATIONWIDE' ? t('area.nationwide') : e.area.name ? t('area.prefecture', { name: e.area.name }) : t('area.otherPrefecture')}
            </Chip>
          )}
          {e.channels.slice(0, 3).map((ch) => <Chip key={ch} color="outline">{t(`channels.${ch}`)}</Chip>)}
        </span>
      )}
      {e.hours && <span className="text-t12_5 text-mist">{e.hours}</span>}
      <span className="flex flex-wrap items-center gap-x-4">
        {e.phone && <a href={`tel:${e.phone}`} className={action}>{t('call')}</a>}
        {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer" className={action}>{t('website')}</a>}
        {canDecide && e.canShare && (
          agreed.has(e.id)
            ? <span className="inline-flex min-h-[44px] items-center text-t12_5 font-bold text-leaf">{t('agreed')}</span>
            : <button type="button" disabled={busyId === e.id} onClick={() => void consent(e.id)} className={`${action} disabled:text-mist`}>{t('okToShare')}</button>
        )}
      </span>
    </Card>
  )
  return (
    <section className="flex flex-col gap-2">
      {header}
      {data.suggestions.map(render)}
      {sourceLine(data.suggestions)}
    </section>
  )
}
