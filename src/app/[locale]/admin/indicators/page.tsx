'use client'

// 運営｜指標の仕分け。確定した指標だけが社会貢献の記録と地図に数えられる。解決済みの相談は記録が付け直される
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, Lead, TextField } from '@/components/app/ui'

type Item = { code: string; text: string; source?: string; confidence?: number | null; reason?: string | null }
type CaseQ = { id: string; displayId: string; title: string; status: string; subjectType: string; summary: string; proposed: Item[]; confirmed: Item[] }

export default function IndicatorsPage() {
  const [cases, setCases] = useState<CaseQ[] | null>(null)
  const [add, setAdd] = useState<Record<string, string>>({})
  const load = useCallback(async () => {
    const d = await apiFetch<{ cases: CaseQ[] }>('/api/admin/indicators').catch(() => ({ cases: [] }))
    setCases(d.cases)
  }, [])
  useEffect(() => { void load() }, [load])
  const decide = async (caseId: string, code: string, decision: 'CONFIRM' | 'REJECT' | 'ADD') => {
    await apiFetch('/api/admin/indicators', { method: 'POST', json: { caseId, code, decision } }).catch(() => undefined)
    await load()
  }
  return (
    <AdminShell title="指標の仕分け">
      <Lead>本人が選んだ指標(実線)と AI の候補(点線)を確かめて決めます。確定した指標だけが、地図と社会貢献の記録に数えられます。</Lead>
      {cases?.length === 0 && <Lead>確かめ待ちはありません。</Lead>}
      {cases?.map((c) => (
        <Card key={c.id} tone="support" className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[12px] text-mist">{c.displayId}</span><Chip>{c.subjectType}</Chip><Chip color={c.status === 'RESOLVED' ? 'leaf' : 'steel'}>{c.status}</Chip></div>
          <span className="text-[14.5px] font-bold">{c.title}</span>
          <Lead>{c.summary}</Lead>
          {c.confirmed.length > 0 && <div className="flex flex-wrap gap-1">{c.confirmed.map((i) => <Chip key={i.code} color="leaf">確定 {i.code}</Chip>)}</div>}
          {c.proposed.map((p) => (
            <div key={`${p.source}${p.code}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
              <span className="text-[13px]"><Chip color={p.source === 'SELF' ? 'night' : 'outline'}>{p.source === 'SELF' ? '本人' : 'AI'} {p.code}</Chip> {p.text}{p.reason ? `(${p.reason})` : ''}</span>
              <span className="flex gap-1.5">
                <Button tone="support" variant="night" className="min-h-[36px] px-3 text-[12.5px]" onClick={() => void decide(c.id, p.code, 'CONFIRM')}>確定</Button>
                <Button tone="support" variant="outline" className="min-h-[36px] px-3 text-[12.5px]" onClick={() => void decide(c.id, p.code, 'REJECT')}>外す</Button>
              </span>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <TextField label="ほかの指標を足す(番号)" value={add[c.id] ?? ''} onChange={(e) => setAdd({ ...add, [c.id]: e.target.value.trim() })} className="flex-1" />
            <Button tone="support" variant="outline" disabled={!add[c.id]} onClick={() => void decide(c.id, add[c.id], 'ADD')}>足す</Button>
          </div>
        </Card>
      ))}
    </AdminShell>
  )
}
