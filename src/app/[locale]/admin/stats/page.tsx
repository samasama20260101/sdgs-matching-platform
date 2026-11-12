'use client'

// 運営｜分析
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card, Lead, SectionLabel } from '@/components/app/ui'

type Stats = { thisMonth: number; resolvedRate: number | null; unmatched: number; supporters: { organizations: number; individuals: number }; waitingByIndicator: [string, number][] }

export default function StatsPage() {
  const [s, setS] = useState<Stats | null>(null)
  useEffect(() => { apiFetch<Stats>('/api/admin/stats').then(setS).catch(() => setS(null)) }, [])
  const tile = (label: string, value: string) => (
    <Card tone="support" className="flex flex-col gap-1 p-4"><span className="text-t12 text-mist">{label}</span><span className="text-t24 font-bold">{value}</span></Card>
  )
  return (
    <AdminShell title="分析">
      {s && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {tile('今月の相談', String(s.thisMonth))}
            {tile('解決まで届いた割合', s.resolvedRate === null ? '—' : `${s.resolvedRate}%`)}
            {tile('24時間申し出のない相談', String(s.unmatched))}
            {tile('支え手(団体・個人)', `${s.supporters.organizations}・${s.supporters.individuals}`)}
          </div>
          <Card tone="support" className="flex flex-col gap-1 p-4">
            <SectionLabel>待っている相談の多い指標(営業とつなぎ先集めの優先順位に)</SectionLabel>
            {s.waitingByIndicator.length === 0 && <Lead>ありません。</Lead>}
            {s.waitingByIndicator.map(([code, n]) => <div key={code} className="flex justify-between text-t13_5"><span>{code}</span><span className="font-bold">{n}</span></div>)}
          </Card>
        </>
      )}
    </AdminShell>
  )
}
