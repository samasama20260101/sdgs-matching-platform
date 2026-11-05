'use client'

// 待つあいだに、近くの窓口(盤 13)。公開データのつなぎ先。運営が伝えてよいかは本人が選ぶ
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { Card, Chip, Tip } from '@/components/app/ui'

type Entry = {
  id: string
  kind: string
  name: string
  phone: string | null
  website: string | null
  hours: string | null
  address: string | null
  unregistered: boolean
  attribution: string | null
  sourceUrl: string
}

export function Referrals({ caseId, canDecide, consented }: { caseId: string; canDecide: boolean; consented: string[] }) {
  const t = useTranslations('consult.referrals')
  const [data, setData] = useState<{ local: Entry[]; national: Entry[] } | null>(null)
  const [agreed, setAgreed] = useState<Set<string>>(new Set(consented))
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ local: Entry[]; national: Entry[] }>(`/api/cases/${caseId}/referrals`).then(setData).catch(() => setData({ local: [], national: [] }))
  }, [caseId])

  const consent = async (entryId: string) => {
    setBusyId(entryId)
    try {
      await apiFetch(`/api/cases/${caseId}/referrals`, { method: 'POST', json: { entryId } })
      setAgreed((s) => new Set([...s, entryId]))
    } finally {
      setBusyId(null)
    }
  }

  if (!data || (data.local.length === 0 && data.national.length === 0)) return null
  // 札は名前と、できること(電話する・サイトを見る・運営から伝えてもらう)を1行に並べるだけにする。
  // 出典は札ごとに出さず、一覧の下に1回だけまとめる(PDL1.0・CC BY の表記の義務は一覧の単位で満たす)
  const action = 'inline-flex min-h-[44px] items-center text-[13px] font-bold text-night no-underline'
  const render = (e: Entry) => (
    <Card key={e.id} className="flex flex-col gap-1 px-3.5 pb-1 pt-3">
      <span className="flex items-start justify-between gap-2">
        <span className="text-[14.5px] font-bold leading-[1.5]">{e.name}</span>
        <Chip>{e.kind === 'PUBLIC_WINDOW' || e.kind === 'NATIONAL_HOTLINE' ? t('public') : t('organization')}</Chip>
      </span>
      {e.hours && <span className="text-[12.5px] text-mist">{e.hours}</span>}
      <span className="flex flex-wrap items-center gap-x-4">
        {e.phone && <a href={`tel:${e.phone}`} className={action}>{t('call')}</a>}
        {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer" className={action}>{t('website')}</a>}
        {canDecide && e.kind !== 'NATIONAL_HOTLINE' && (
          agreed.has(e.id)
            ? <span className="inline-flex min-h-[44px] items-center text-[12.5px] font-bold text-leaf">{t('agreed')}</span>
            : <button type="button" disabled={busyId === e.id} onClick={() => void consent(e.id)} className={`${action} disabled:text-mist`}>{t('okToShare')}</button>
        )}
      </span>
    </Card>
  )
  const entries = [...data.local, ...data.national]
  const sources = [...new Map(entries.map((e) => [e.attribution ?? e.sourceUrl, e])).values()]
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[15px] font-bold">{t('title')}</span>
        <Tip label={t('tipLabel')}>{t('tip')}</Tip>
      </div>
      {entries.map(render)}
      <p className="m-0 px-1 text-[11px] leading-[1.6] text-mist">
        {sources.map((e, i) => (
          <span key={e.id}>
            {i > 0 && ' ／ '}
            {/* 表記が「出典」で始まるものはそのまま出す */}
            {e.attribution?.startsWith('出典') ? '' : `${t('source')}: `}
            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-mist">{e.attribution ?? e.sourceUrl}</a>
          </span>
        ))}
      </p>
    </section>
  )
}
