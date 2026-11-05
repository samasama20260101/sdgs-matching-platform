'use client'

// 運営｜解決の要約(ナレッジ)。よい取り組みはモデルケースとして紹介する(11/5)
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, Lead, SectionLabel } from '@/components/app/ui'

type Summary = { case_id: string; content: string; actions: string; aftermath: string; source: string; is_model_case: boolean; created_at: string; cases: { display_id: string } | null }

export default function SummariesPage() {
  const [items, setItems] = useState<Summary[] | null>(null)
  const load = useCallback(async () => setItems((await apiFetch<{ summaries: Summary[] }>('/api/admin/summaries').catch(() => ({ summaries: [] }))).summaries), [])
  useEffect(() => { void load() }, [load])
  const toggle = async (caseId: string, isModelCase: boolean) => {
    await apiFetch('/api/admin/summaries', { method: 'PATCH', json: { caseId, isModelCase } }).catch(() => undefined)
    await load()
  }
  return (
    <AdminShell title="解決の要約">
      <Lead>解決した相談を、内容・取った手立て・その後の1枚にまとめたものです(AI が作り、名前や連絡先は伏せています)。</Lead>
      {items?.length === 0 && <Lead>まだありません。</Lead>}
      {items?.map((s) => (
        <Card key={s.case_id} tone="support" className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2"><span className="text-[12px] text-mist">{s.cases?.display_id} ・ {s.created_at.slice(0, 10)}</span>{s.is_model_case && <Chip color="lamp">モデルケース</Chip>}</div>
          <SectionLabel>内容</SectionLabel><Lead>{s.content}</Lead>
          <SectionLabel>取った手立て</SectionLabel><Lead>{s.actions}</Lead>
          <SectionLabel>その後</SectionLabel><Lead>{s.aftermath}</Lead>
          <Button tone="support" variant="outline" className="self-start" onClick={() => void toggle(s.case_id, !s.is_model_case)}>{s.is_model_case ? 'モデルケースから外す' : 'モデルケースにする'}</Button>
        </Card>
      ))}
    </AdminShell>
  )
}
