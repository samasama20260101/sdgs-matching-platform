'use client'

// 運営｜審査。申し込み → 面談の調整中 → 承認(2段階に分けない、11/5)。面談のチェックリストは運営が決める項目を書き込む
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, cx, ErrorNote, Lead, TextArea, TextField } from '@/components/app/ui'
import { SUPPORTER_CHECKS, choiceKey, isSelfCheck, noteKey, parseCheckKey } from '@/lib/domain/supporterChecks'

const STATUSES = [['APPLIED', '申し込み'], ['INTERVIEW', '面談の調整中'], ['APPROVED', '承認済み'], ['REJECTED', '見送り'], ['SUSPENDED', '停止']] as const
// 11/12 より前の申し込みにあった項目(今の申し込みの画面にはない)
const LEGACY_LABELS: Record<string, string> = { activities: 'どんな活動をしていますか(前の項目)', targets: '支えられる困りごと・相手(前の項目)' }

// 申し込みの6つの点(面談で確かめる点)の自己採点と一言
function SelfCheckAnswers({ application }: { application: Record<string, string> }) {
  const t = useTranslations('support.join')
  if (!SUPPORTER_CHECKS.some((c) => application[choiceKey(c)] || application[noteKey(c)])) return null
  return (
    <ol className="m-0 flex list-none flex-col gap-2 rounded-tool bg-steel-faint p-3 text-[12.5px]">
      {SUPPORTER_CHECKS.map((c, i) => {
        const choice = application[choiceKey(c)]
        const note = application[noteKey(c)]
        return (
          <li key={c} className="flex flex-col gap-0.5">
            <span className="text-mist">{i + 1}. {t(`checks.${c}.statement`)}</span>
            <span className={cx('font-bold', choice === 'discuss' && 'text-dawn-ink')}>{isSelfCheck(choice) ? t(`selfCheck.${choice}`) : '(未回答)'}</span>
            {note && <span className="whitespace-pre-wrap">{note}</span>}
          </li>
        )
      })}
    </ol>
  )
}

type Org = { id: string; display_id: string; name: string; org_type: string; vetting_status: string; applied_at: string | null; application: Record<string, string>; contact_email: string | null; prefecture: string | null; population: number | null }

function OrgCard({ org, onChanged, focused }: { org: Org; onChanged: () => Promise<void>; focused: boolean }) {
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
  const t = useTranslations('support.join')
  const appLabel = (k: string) => LEGACY_LABELS[k] ?? (t.has(`application.${k}`) ? t(`application.${k}`) : k)
  const purpose = org.application?.purpose === 'CONSULT' ? '相談のための登録' : '支え手の申し込み'
  return (
    <div id={org.display_id} className="scroll-mt-4">
      <Card tone="support" className={cx('flex flex-col gap-2 p-4', focused && 'ring-2 ring-night')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold">{org.name}</span>
          <Chip>{org.org_type}</Chip><Chip color="outline">{purpose}</Chip><span className="text-[12px] text-mist">{org.display_id}</span>
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          {org.contact_email && <><dt className="text-mist">連絡先</dt><dd className="m-0">{org.contact_email}</dd></>}
          {org.prefecture && <><dt className="text-mist">地域</dt><dd className="m-0">{org.prefecture}</dd></>}
          {org.population && <><dt className="text-mist">対象の人数</dt><dd className="m-0">{org.population.toLocaleString('ja')}</dd></>}
          {Object.entries(org.application ?? {}).filter(([k]) => k !== 'purpose' && !parseCheckKey(k)).flatMap(([k, v]) => [<dt key={`${k}-t`} className="text-mist">{appLabel(k)}</dt>, <dd key={`${k}-d`} className="m-0 whitespace-pre-wrap">{v}</dd>])}
        </dl>
        <SelfCheckAnswers application={org.application ?? {}} />
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
    </div>
  )
}

// 運営への知らせ(Discord)のリンクは /admin/vetting#ORG-0001。札が画面に出たあとで、その団体の札まで送って枠で示す。
// 運営の画面はログインと2つ目の確認が済んでから中身を出すので、札を並べるこの部品の中で行う
function OrgList({ organizations, onChanged }: { organizations: Org[]; onChanged: () => Promise<void> }) {
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (!hash) return
    const el = document.getElementById(hash)
    if (!el) return
    el.scrollIntoView({ block: 'start' })
    const timer = window.setTimeout(() => setFocus(hash), 0)
    return () => window.clearTimeout(timer)
  }, [organizations])
  return organizations.map((o) => <OrgCard key={o.id} org={o} onChanged={onChanged} focused={focus === o.display_id} />)
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
      {data && <OrgList organizations={data.organizations} onChanged={reload} />}
    </AdminShell>
  )
}
