'use client'

// 待つあいだに、近くの窓口(盤 13)。公開データのつなぎ先。運営が伝えてよいかは本人が選ぶ
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { Button, Card, Chip, Tip } from '@/components/app/ui'

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
  const render = (e: Entry) => (
    <Card key={e.id} className="flex flex-col gap-2 p-3.5">
      <span className="text-[14.5px] font-bold">{e.name}</span>
      <span className="flex flex-wrap gap-1">
        <Chip>{e.kind === 'PUBLIC_WINDOW' || e.kind === 'NATIONAL_HOTLINE' ? t('public') : t('organization')}</Chip>
        {e.unregistered && e.kind === 'ORGANIZATION' && <Chip color="outline">{t('unregistered')}</Chip>}
      </span>
      {e.hours && <span className="text-[12.5px] text-mist">{e.hours}</span>}
      <span className="flex flex-wrap gap-3 text-[13px]">
        {e.phone && <a href={`tel:${e.phone}`} className="font-bold text-night">{t('call')}</a>}
        {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-night">{t('website')}</a>}
      </span>
      {canDecide && e.kind !== 'NATIONAL_HOTLINE' && (
        agreed.has(e.id)
          ? <span className="text-[12.5px] font-bold text-leaf">{t('agreed')}</span>
          : <Button variant="outline" disabled={busyId === e.id} onClick={() => void consent(e.id)} className="min-h-[40px] text-[13px]">{t('okToShare')}</Button>
      )}
      <span className="text-[11px] text-mist">
        {/* 出典の表記(PDL1.0・CC BY の義務)。表記が「出典」で始まるものはそのまま出す */}
        {e.attribution?.startsWith('出典') ? '' : `${t('source')}: `}
        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-mist">{e.attribution ?? e.sourceUrl}</a>
      </span>
    </Card>
  )
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[15px] font-bold">{t('title')}</span>
        <Tip label={t('tipLabel')}>{t('tip')}</Tip>
      </div>
      {data.local.map(render)}
      {data.national.map(render)}
    </section>
  )
}
