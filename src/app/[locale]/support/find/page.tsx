'use client'

// 支える｜相談をさがす(盤 22)。大項目・遠隔を含める・関わり方で絞る。待っている時間が長い順
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, Heading, Lead, Tip, Toggle } from '@/components/app/ui'
import { CaseCard } from '@/components/support/CaseCard'
import { FacePicker, useFace } from '@/components/support/useFace'
import type { SupportCaseItem } from '@/lib/server/supportCases'

const CATEGORIES = Array.from({ length: 17 }, (_, i) => i + 1)

function Find() {
  const t = useTranslations('support.find')
  const tSdgs = useTranslations('sdgs')
  const { options, current, choose } = useFace()
  const [category, setCategory] = useState<number | null>(null)
  const [remote, setRemote] = useState(false)
  const [involvement, setInvolvement] = useState<'all' | 'notOffered' | 'mine'>('notOffered')
  const [items, setItems] = useState<SupportCaseItem[] | null>(null)
  const [lockedCount, setLockedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!current) return
    const q = new URLSearchParams({ face: current.key, involvement })
    if (category) q.set('category', String(category))
    if (remote) q.set('remote', '1')
    setItems(null)
    apiFetch<{ cases: SupportCaseItem[]; lockedCount: number }>(`/api/support/cases?${q}`)
      .then((d) => { setItems(d.cases.filter((c) => !c.locked)); setLockedCount(d.lockedCount); setError(null) })
      .catch(() => { setItems([]); setError(t('loadFailed')) })
  }, [current, category, remote, involvement, t])

  return (
    <>
      <FacePicker options={options} current={current} onChoose={choose} />
      <div className="flex items-center justify-between">
        <Heading level={2}>{t('title')}</Heading>
        <Tip label={t('tipLabel')}>{t('tip')}</Tip>
      </div>
      {current?.kind === 'INDIVIDUAL' && <Card tone="support" className="p-3"><Lead>{t('individualNote')}</Lead></Card>}
      {/* 大項目は選ぶ形にする(札を並べるとスマホで何段にも折り返し、横に流すと右端が切れて見えるため。AGENTS.md) */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">{t('category')}</span>
        <select value={category ?? ''} onChange={(e) => setCategory(e.target.value ? Number(e.target.value) : null)} className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px]">
          <option value="">{t('all')}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{tSdgs(`category.${c}`)}</option>)}
        </select>
      </label>
      <Card tone="support" className="flex flex-col px-4 py-1">
        <Toggle checked={remote} onChange={setRemote} label={t('remote')} description={t('remoteNote')} />
        <label className="flex min-h-[48px] items-center justify-between gap-3 text-[14px] font-bold">
          {t('involvement')}
          <select value={involvement} onChange={(e) => setInvolvement(e.target.value === 'mine' ? 'mine' : e.target.value === 'all' ? 'all' : 'notOffered')} className="min-h-[40px] rounded-tool border border-line-strong bg-paper px-2 text-[14px] font-normal">
            <option value="notOffered">{t('notOffered')}</option>
            <option value="mine">{t('mine')}</option>
            <option value="all">{t('everything')}</option>
          </select>
        </label>
      </Card>
      {lockedCount > 0 && <Card tone="support" className="bg-lamp-faint p-3"><Lead>{t('locked', { count: lockedCount })}</Lead></Card>}
      {error && <Lead>{error}</Lead>}
      {items && <span className="px-1 text-[12.5px] text-mist">{t('count', { count: items.length })}</span>}
      {(items ?? []).map((c) => <CaseCard key={c.id} item={c} face={current?.key ?? ''} />)}
    </>
  )
}

export default function FindPage() {
  return (
    <RequireMe>
      {() => <AppFrame tone="support"><Find /></AppFrame>}
    </RequireMe>
  )
}
