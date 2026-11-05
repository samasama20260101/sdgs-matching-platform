'use client'

// 運営｜お問い合わせ(最後のセーフティネット)。退会・ログインの方法の付け替え・支え手とのやりとりの困りごとなど
import { useCallback, useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, cx, Lead, TextArea } from '@/components/app/ui'

type Inquiry = { id: string; display_id: string; role: string | null; name: string | null; email: string; organization: string | null; category: string; message: string; status: string; admin_memo: string | null; created_at: string; users: { display_name: string | null } | null }
const STATUS = [['OPEN', '未対応'], ['IN_PROGRESS', '対応中'], ['CLOSED', '完了']] as const

function Row({ q, onSaved }: { q: Inquiry; onSaved: () => Promise<void> }) {
  const [memo, setMemo] = useState(q.admin_memo ?? '')
  const save = async (status?: string) => {
    await apiFetch('/api/admin/inquiries', { method: 'PATCH', json: { id: q.id, status, admin_memo: memo } }).catch(() => undefined)
    await onSaved()
  }
  return (
    <Card tone="support" className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-mist">{q.display_id} ・ {q.created_at.slice(0, 16).replace('T', ' ')} <Chip>{q.category}</Chip></div>
      <span className="text-[13px]">{q.users?.display_name ?? q.name ?? '—'} ・ {q.email}{q.organization ? ` ・ ${q.organization}` : ''}</span>
      <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.7]">{q.message}</p>
      <TextArea label="運営のメモ" value={memo} rows={2} onChange={(e) => setMemo(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {STATUS.map(([k, label]) => <Button key={k} tone="support" variant={q.status === k ? 'night' : 'outline'} className="min-h-[44px] text-[12.5px]" onClick={() => void save(k)}>{label}</Button>)}
      </div>
    </Card>
  )
}

export default function InquiriesPage() {
  const [status, setStatus] = useState('OPEN')
  const fetchInquiries = useCallback(() => apiFetch<{ inquiries: Inquiry[] }>(`/api/admin/inquiries?status=${status}`).then((d) => d.inquiries, () => [] as Inquiry[]), [status])
  const { data: items, reload } = useLoad(fetchInquiries)
  return (
    <AdminShell title="お問い合わせ">
      <Lead>ログインの方法の付け替えは、本人だと確かめてから Supabase の画面で行い、メモに確かめた内容を残してください。</Lead>
      <div className="flex gap-1.5">
        {STATUS.map(([k, label]) => <button key={k} type="button" onClick={() => setStatus(k)} className={cx('min-h-[44px] rounded-full px-3 text-[12.5px] font-bold', status === k ? 'bg-night text-white' : 'border border-line bg-paper')}>{label}</button>)}
      </div>
      {items?.length === 0 && <Lead>ありません。</Lead>}
      {items?.map((q) => <Row key={q.id} q={q} onSaved={reload} />)}
    </AdminShell>
  )
}
