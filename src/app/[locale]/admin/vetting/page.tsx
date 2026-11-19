'use client'

// 運営｜審査。申し込み → 面談の調整中 → 承認(2段階に分けない、11/5)。面談のチェックリストは運営が決める項目を書き込む。
// 会社・地域として相談するために登録した団体は審査に並べず「相談のための団体」に分ける(#131)。止める・止めるのを解くだけ
// 申し込みで前もって載せている団体(掲載台帳の行)を選んだ支援団体は、承認でその行と結ぶ(#140)。面談で本人の団体かを確かめる
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, cx, ErrorNote, Lead, TextArea, TextField } from '@/components/app/ui'
import { SUPPORTER_CHECKS, choiceKey, isSelfCheck, noteKey, parseCheckKey } from '@/lib/domain/supporterChecks'
import { isSupporterPurpose } from '@/lib/domain/publicSupporter'
import { DIRECTORY_ENTRY_KEY } from '@/lib/domain/directoryClaim'

const STATUSES = [['APPLIED', '申し込み'], ['INTERVIEW', '面談の調整中'], ['APPROVED', '承認済み'], ['REJECTED', '見送り'], ['SUSPENDED', '停止'], ['NOT_APPLIED', '相談者の会社・地域']] as const
// 11/12 より前の申し込みにあった項目(今の申し込みの画面にはない)
const LEGACY_LABELS: Record<string, string> = { activities: 'どんな活動をしていますか(前の項目)', targets: '支えられる困りごと・相手(前の項目)', areas: '活動している地域(前の項目)' }

// 申し込みの6つの点(面談で確かめる点)の自己採点と一言
function SelfCheckAnswers({ application }: { application: Record<string, string> }) {
  const t = useTranslations('support.join')
  if (!SUPPORTER_CHECKS.some((c) => application[choiceKey(c)] || application[noteKey(c)])) return null
  return (
    <ol className="m-0 flex list-none flex-col gap-2 rounded-tool bg-steel-faint p-3 text-t12_5">
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

type DirectoryEntry =
  | { id: string; name: string; prefectureName: string | null; website: string | null; corporateNumber: string | null; state: 'LINKABLE' | 'LINKED' | 'TAKEN' }
  | { id: string; state: 'GONE' }
type Org = {
  id: string; display_id: string; name: string; org_type: string; vetting_status: string; applied_at: string | null; application: Record<string, string>
  contact_email: string | null; prefecture: string | null; population: number | null
  service_areas: { nationwide: boolean; regionNames: string[] } | null
  directory_entry: DirectoryEntry | null
}

const LINK_MESSAGES: Record<string, string> = {
  LINKED: '掲載台帳の行と結びました',
  TAKEN: '掲載台帳の行は、ほかの支援団体と結び済みのため結べませんでした',
  GONE: '掲載台帳の行が見つからないため結べませんでした',
  FAILED: '掲載台帳の行と結べませんでした。「掲載台帳の行と結ぶ」をもう一度押してください',
}

// 申し込みで選んだ掲載台帳の行。承認すると、行の名前と活動地域をこの申し込みの内容に合わせる(法人番号は行に無いときだけ足す)。
// 出典の列と、出典から調べた電話・住所・相談の受け方は残す。結んだ行は相談に合う支援団体の提案に出なくなる
function DirectoryEntryBox({ entry, approved, onUnlink, onLink }: { entry: DirectoryEntry; approved: boolean; onUnlink: () => void; onLink: () => void }) {
  if (entry.state === 'GONE') {
    return (
      <div className="flex flex-col gap-1 rounded-tool bg-steel-faint p-3 text-t12_5">
        <span className="font-bold">掲載台帳の行: 見つかりません(消えたか、民間の団体の行ではありません)</span>
        <div><Button tone="support" variant="outline" onClick={onUnlink}>選んだ行を外す</Button></div>
      </div>
    )
  }
  const status = entry.state === 'LINKED' ? '結び済み'
    : entry.state === 'TAKEN' ? 'ほかの支援団体と結び済み(結べません)'
      : approved ? 'まだ結んでいません' : '承認すると結びます'
  return (
    <div className="flex flex-col gap-1.5 rounded-tool bg-steel-faint p-3 text-t12_5">
      <span className="text-mist">申し込みで選んだ、前もって載せていた団体(掲載台帳の行)。面談で、この団体の方かを確かめてください</span>
      <span className="text-t14 font-bold">{entry.name}</span>
      <span>
        {[entry.prefectureName, entry.corporateNumber && `法人番号 ${entry.corporateNumber}`].filter(Boolean).join(' / ')}
        {entry.website && <> / <a href={entry.website} target="_blank" rel="noopener noreferrer" className="font-bold text-night">サイト</a></>}
      </span>
      <span className={cx('font-bold', entry.state === 'TAKEN' && 'text-dawn-ink')}>{status}</span>
      {entry.state !== 'LINKED' && (
        <span className="text-mist">承認すると、行の名前と活動地域をこの申し込みの内容に合わせ、相談に合う支援団体の提案に出なくなります(出典・電話・住所・相談の受け方は残します)。</span>
      )}
      <div className="flex flex-wrap gap-2">
        {entry.state !== 'LINKED' && <Button tone="support" variant="outline" onClick={onUnlink}>選んだ行を外す</Button>}
        {approved && entry.state === 'LINKABLE' && <Button tone="support" variant="night" onClick={onLink}>掲載台帳の行と結ぶ</Button>}
      </div>
    </div>
  )
}

function OrgCard({ org, onChanged, onNotice, focused }: { org: Org; onChanged: () => Promise<void>; onNotice: (message: string | null) => void; focused: boolean }) {
  const [note, setNote] = useState('')
  const [region, setRegion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const set = async (body: Record<string, unknown>) => {
    setError(null)
    onNotice(null)
    try {
      const result = await apiFetch<{ ok: boolean; directoryLink?: string | null }>(`/api/admin/orgs/${org.id}`, { method: 'PATCH', json: body })
      // 承認すると札が今の一覧から外れるので、結んだ結果は画面の上に出す
      if (result.directoryLink) onNotice(`${org.name}: ${LINK_MESSAGES[result.directoryLink] ?? result.directoryLink}`)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '変えられませんでした')
    }
  }
  const t = useTranslations('support.join')
  const appLabel = (k: string) => LEGACY_LABELS[k] ?? (t.has(`application.${k}`) ? t(`application.${k}`) : k)
  const supporter = isSupporterPurpose(org.application)
  const purpose = supporter ? '支援団体の申し込み' : '相談者の会社・地域'
  return (
    <div id={org.display_id} className="scroll-mt-4">
      <Card tone="support" className={cx('flex flex-col gap-2 p-4', focused && 'ring-2 ring-night')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-t15 font-bold">{org.name}</span>
          <Chip>{org.org_type}</Chip><Chip color="outline">{purpose}</Chip><span className="text-t12 text-mist">{org.display_id}</span>
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-t12_5">
          {org.contact_email && <><dt className="text-mist">連絡先</dt><dd className="m-0">{org.contact_email}</dd></>}
          {org.prefecture && <><dt className="text-mist">地域</dt><dd className="m-0">{org.prefecture}</dd></>}
          {org.service_areas && <><dt className="text-mist">活動地域</dt><dd className="m-0">{org.service_areas.nationwide ? '全国' : org.service_areas.regionNames.join('・')}</dd></>}
          {org.population && <><dt className="text-mist">対象の人数</dt><dd className="m-0">{org.population.toLocaleString('ja')}</dd></>}
          {Object.entries(org.application ?? {}).filter(([k]) => k !== 'purpose' && k !== DIRECTORY_ENTRY_KEY && !parseCheckKey(k)).flatMap(([k, v]) => [<dt key={`${k}-t`} className="text-mist">{appLabel(k)}</dt>, <dd key={`${k}-d`} className="m-0 whitespace-pre-wrap">{v}</dd>])}
        </dl>
        <SelfCheckAnswers application={org.application ?? {}} />
        {supporter && org.directory_entry && (
          <DirectoryEntryBox
            entry={org.directory_entry}
            approved={org.vetting_status === 'APPROVED'}
            onUnlink={() => void set({ directoryEntry: 'UNLINK' })}
            onLink={() => void set({ directoryEntry: 'LINK' })}
          />
        )}
        <TextArea label="面談のメモ・チェックリスト(運営が決める項目)" value={note} rows={3} onChange={(e) => setNote(e.target.value)} />
        {supporter ? (
          <div className="flex flex-wrap gap-2">
            {org.vetting_status === 'APPLIED' && <Button tone="support" variant="outline" onClick={() => void set({ vettingStatus: 'INTERVIEW', note })}>面談の調整中にする</Button>}
            {org.vetting_status !== 'APPROVED' && <Button tone="support" variant="night" onClick={() => void set({ vettingStatus: 'APPROVED', note })}>承認する(一覧に載る)</Button>}
            {org.vetting_status !== 'REJECTED' && org.vetting_status !== 'APPROVED' && <Button tone="support" variant="danger" onClick={() => void set({ vettingStatus: 'REJECTED', note })}>見送る</Button>}
            {org.vetting_status === 'APPROVED' && <Button tone="support" variant="danger" onClick={() => void set({ vettingStatus: 'SUSPENDED', note })}>停止する</Button>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-t12_5 text-mist">相談者の会社・地域は審査しません。支える側に立つには、この会社・地域の管理の人が支援団体の申し込みをします。止めると、この会社・地域として相談できなくなります。</span>
            <div className="flex flex-wrap gap-2">
              {org.vetting_status === 'SUSPENDED'
                ? <Button tone="support" variant="outline" onClick={() => void set({ vettingStatus: 'NOT_APPLIED', note })}>止めるのを解く</Button>
                : <Button tone="support" variant="danger" onClick={() => void set({ vettingStatus: 'SUSPENDED', note })}>停止する</Button>}
            </div>
          </div>
        )}
        {supporter && org.vetting_status === 'APPROVED' && ['MUNICIPALITY', 'INTERMEDIARY'].includes(org.org_type) && (
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
function OrgList({ organizations, onChanged, onNotice }: { organizations: Org[]; onChanged: () => Promise<void>; onNotice: (message: string | null) => void }) {
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
  return organizations.map((o) => <OrgCard key={o.id} org={o} onChanged={onChanged} onNotice={onNotice} focused={focus === o.display_id} />)
}

export default function VettingPage() {
  const [status, setStatus] = useState<string>('APPLIED')
  const fetchOrgs = useCallback(() => apiFetch<{ organizations: Org[]; counts: Record<string, number> }>(`/api/admin/orgs?status=${status}`).catch(() => null), [status])
  const { data, reload } = useLoad(fetchOrgs)
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <AdminShell title="審査">
      <Lead>支援団体の申し込みフォーム → 運営へ知らせ → 面談 → 承認で一覧に載ります(11/5 定例)。承認した支援団体は、機微な相談と18歳未満の相談も受けられます。会社・地域として相談するために登録したもの(相談者の会社・地域)は審査に並ばず、「相談者の会社・地域」に入ります。</Lead>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setStatus(k)} className={cx('min-h-[44px] rounded-full px-3 text-t12_5 font-bold', status === k ? 'bg-night text-white' : 'border border-line bg-paper')}>
            {label} {data?.counts?.[k] ?? ''}
          </button>
        ))}
      </div>
      {notice && <Card tone="support" className="p-3 text-t13 font-bold"><span role="status">{notice}</span></Card>}
      {data?.organizations.length === 0 && <Lead>ありません。</Lead>}
      {data && <OrgList organizations={data.organizations} onChanged={reload} onNotice={setNotice} />}
    </AdminShell>
  )
}
