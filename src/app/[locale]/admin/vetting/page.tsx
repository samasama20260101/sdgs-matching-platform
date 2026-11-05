'use client'

// 運営｜審査。申し込み → 面談の調整中 → 承認(2段階に分けない、11/5)。面談のチェックリストは運営が決める項目を書き込む
import { useCallback, useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, cx, ErrorNote, Lead, TextArea, TextField } from '@/components/app/ui'

const STATUSES = [['APPLIED', '申し込み'], ['INTERVIEW', '面談の調整中'], ['APPROVED', '承認済み'], ['REJECTED', '見送り'], ['SUSPENDED', '停止']] as const
type Org = { id: string; display_id: string; name: string; org_type: string; vetting_status: string; applied_at: string | null; application: Record<string, string>; contact_email: string | null; prefecture: string | null; population: number | null }

function OrgCard({ org, onChanged }: { org: Org; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState('')
  const [region, setRegion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const set = async (body: Record<string, unknown>) => {
    setError(null)
    try {
      await apiFetch(`/api/admin/orgs/${org.id}`, { method: 'PATCH', json: body })
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '変えられませんでした')
    }
  }
  const purpose = org.application?.purpose === 'CONSULT' ? '相談のための登録' : '支え手の申し込み'
  return (
    <Card tone="support" className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-bold">{org.name}</span>
        <Chip>{org.org_type}</Chip><Chip color="outline">{purpose}</Chip><span className="text-[12px] text-mist">{org.display_id}</span>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
        {org.contact_email && <><dt className="text-mist">連絡先</dt><dd className="m-0">{org.contact_email}</dd></>}
        {org.prefecture && <><dt className="text-mist">地域</dt><dd className="m-0">{org.prefecture}</dd></>}
        {org.population && <><dt className="text-mist">対象の人数</dt><dd className="m-0">{org.population.toLocaleString('ja')}</dd></>}
        {Object.entries(org.application ?? {}).filter(([k]) => k !== 'purpose').flatMap(([k, v]) => [<dt key={`${k}-t`} className="text-mist">{k}</dt>, <dd key={`${k}-d`} className="m-0 whitespace-pre-wrap">{v}</dd>])}
      </dl>
      <TextArea label="面談のメモ・チェックリスト(運営が決める項目)" value={note} rows={3} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {org.vetting_status === 'APPLIED' && <Button tone="support" variant="outline" onClick={() => void set({ vettingStatus: 'INTERVIEW', note })}>面談の調整中にする</Button>}
        {org.vetting_status !== 'APPROVED' && <Button tone="support" variant="night" onClick={() => void set({ vettingStatus: 'APPROVED', note })}>承認する(一覧に載る)</Button>}
        {org.vetting_status !== 'REJECTED' && org.vetting_status !== 'APPROVED' && <Button tone="support" variant="danger" onClick={() => void set({ vettingStatus: 'REJECTED', note })}>見送る</Button>}
        {org.vetting_status === 'APPROVED' && <Button tone="support" variant="danger" onClick={() => void set({ vettingStatus: 'SUSPENDED', note })}>停止する</Button>}
      </div>
      {org.vetting_status === 'APPROVED' && ['MUNICIPALITY', 'INTERMEDIARY'].includes(org.org_type) && (
        <div className="flex items-end gap-2">
          <TextField label="コーディネーターにする地域(例 JP-43)" value={region} onChange={(e) => setRegion(e.target.value.toUpperCase())} className="flex-1" />
          <Button tone="support" variant="outline" onClick={() => void set({ coordinatorRegion: region || null })}>{region ? '設定する' : '外す'}</Button>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Card>
  )
}

export default function VettingPage() {
  const [status, setStatus] = useState<string>('APPLIED')
  const fetchOrgs = useCallback(() => apiFetch<{ organizations: Org[]; counts: Record<string, number> }>(`/api/admin/orgs?status=${status}`).catch(() => null), [status])
  const { data, reload } = useLoad(fetchOrgs)
  return (
    <AdminShell title="審査">
      <Lead>申し込みフォーム → 運営へ知らせ → 面談 → 承認で一覧に載ります(11/5 定例)。承認した団体は、機微な相談と18歳未満の相談も受けられます。</Lead>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setStatus(k)} className={cx('min-h-[44px] rounded-full px-3 text-[12.5px] font-bold', status === k ? 'bg-night text-white' : 'border border-line bg-paper')}>
            {label} {data?.counts?.[k] ?? ''}
          </button>
        ))}
      </div>
      {data?.organizations.length === 0 && <Lead>ありません。</Lead>}
      {data?.organizations.map((o) => <OrgCard key={o.id} org={o} onChanged={reload} />)}
    </AdminShell>
  )
}
