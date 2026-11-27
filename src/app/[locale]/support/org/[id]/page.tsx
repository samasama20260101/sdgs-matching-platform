'use client'

// 団体のページ(紹介・連絡先・活動地域・メンバー・招待)。管理の人だけが変えられる。見出しは団体名にし、団体の番号は下に小さく(画面の見直し 所見 12)
import { use, useCallback, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch, ApiError } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Button, Card, Chip, ErrorNote, Heading, Lead, SectionLabel, Spinner, TextArea, TextField, Tip } from '@/components/app/ui'
import { ServiceAreaPicker, isAreaChoiceComplete, useRegions, type AreaChoice } from '@/components/support/ServiceAreaPicker'
import { OrgPhotoEditor } from '@/components/support/OrgPhotoEditor'

type Payload = {
  organization: { id: string; display_id: string; name: string; org_type: string; vetting_status: string; bio: string | null; contact_email: string | null; population: number | null; supporter: boolean; photoUrl: string | null }
  areas: Areas
  myRole: 'OWNER' | 'MEMBER'
  members: { id: string; role: string; status: string; displayName: string; isMe: boolean }[]
  invitations: { id: string; email: string; role: string }[]
}

type Areas = { country: string; registered: boolean; nationwide: boolean; regionCodes: string[] }

// 活動地域(メンバーみんなが見られ、管理の人だけが変えられる)。「さがす」に出る相談の地域と、公開の団体ページの地域になる
function ServiceAreas({ id, areas, canEdit, onSaved }: { id: string; areas: Areas; canEdit: boolean; onSaved: () => Promise<void> }) {
  const t = useTranslations('support.org')
  const locale = useLocale()
  const regions = useRegions(areas.country)
  const [editing, setEditing] = useState(false)
  const [choice, setChoice] = useState<AreaChoice>({ nationwide: false, regionCodes: [] })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const nameOf = (code: string) => {
    const r = regions?.find((x) => x.code === code)
    return r ? (locale === 'ja' ? r.name_local : r.name_en) : code
  }
  const startEdit = () => {
    setChoice({ nationwide: areas.nationwide, regionCodes: areas.regionCodes })
    setMessage(null)
    setEditing(true)
  }
  const complete = isAreaChoiceComplete(choice)
  const save = async () => {
    if (!complete) return
    setBusy(true)
    setMessage(null)
    try {
      await apiFetch(`/api/support/orgs/${id}/areas`, { method: 'PUT', json: { nationwide: choice.nationwide === true, regionCodes: choice.nationwide ? [] : choice.regionCodes } })
      await onSaved()
      setEditing(false)
      setMessage(t('saved'))
    } catch {
      setMessage(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between"><SectionLabel>{t('areas')}</SectionLabel><Tip label={t('areasTipLabel')}>{t('areasTip')}</Tip></div>
      {!editing ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {areas.nationwide ? <Chip color="leaf">{t('areasNationwide')}</Chip>
              : areas.regionCodes.length > 0 ? areas.regionCodes.map((c) => <Chip key={c} color="outline">{nameOf(c)}</Chip>)
                : <span className="text-t13 text-mist">{t('areasNone')}</span>}
          </div>
          {!areas.registered && areas.regionCodes.length > 0 && <span className="text-t12 text-mist">{t('areasFromApplication')}</span>}
          {canEdit && <Button tone="support" variant="outline" onClick={startEdit}>{t('areasEdit')}</Button>}
        </>
      ) : (
        <>
          <ServiceAreaPicker country={areas.country} value={choice} onChange={setChoice} label={t('areas')} />
          <div className="flex gap-2">
            <Button tone="support" variant="night" className="flex-1" disabled={busy || !complete} onClick={() => void save()}>{t('save')}</Button>
            <Button tone="support" variant="outline" disabled={busy} onClick={() => setEditing(false)}>{t('areasCancel')}</Button>
          </div>
        </>
      )}
      {message && <span className="text-t12_5 font-bold text-ink-soft">{message}</span>}
    </Card>
  )
}

// 団体の紹介・連絡先・対象の人数を直す(管理の人だけ)。人数は会社・地域として相談するときのスコアに使う
function Profile({ id, o, onSaved }: { id: string; o: Payload['organization']; onSaved: () => Promise<void> }) {
  const t = useTranslations('support.org')
  const [bio, setBio] = useState(o.bio ?? '')
  const [contactEmail, setContactEmail] = useState(o.contact_email ?? '')
  const [population, setPopulation] = useState(o.population === null ? '' : String(o.population))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const save = async () => {
    setBusy(true)
    setMessage(null)
    const pop = population.trim() === '' ? null : Number(population)
    try {
      await apiFetch(`/api/support/orgs/${id}`, {
        method: 'PATCH',
        json: { bio: bio.trim() || null, contactEmail: contactEmail.trim() || null, population: pop !== null && Number.isInteger(pop) && pop > 0 ? pop : null },
      })
      await onSaved()
      setMessage(t('saved'))
    } catch {
      setMessage(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <SectionLabel>{t('profile')}</SectionLabel>
      <TextArea label={t('bio')} value={bio} maxLength={1000} rows={3} onChange={(e) => setBio(e.target.value)} />
      <TextField label={t('contactEmail')} hint={t('contactEmailHint')} type="email" value={contactEmail} maxLength={254} onChange={(e) => setContactEmail(e.target.value)} />
      <TextField label={t('population')} hint={t('populationHint')} inputMode="numeric" value={population} onChange={(e) => setPopulation(e.target.value.replace(/[^0-9]/g, ''))} />
      <Button tone="support" variant="night" disabled={busy} onClick={() => void save()}>{t('save')}</Button>
      {message && <span className="text-t12_5 font-bold text-ink-soft">{message}</span>}
    </Card>
  )
}

function Org({ id }: { id: string }) {
  const t = useTranslations('support.org')
  const tStatus = useTranslations('support.vetting')
  const fetchOrg = useCallback(() => apiFetch<Payload>(`/api/support/orgs/${id}`), [id])
  const { data, error: loadError, reload } = useLoad(fetchOrg)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'MEMBER' | 'OWNER'>('MEMBER')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const loadMessage = loadError ? t('notFound') : null

  const invite = async () => {
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/api/support/orgs/${id}/invitations`, { method: 'POST', json: { email, role } })
      setEmail('')
      setNotice(t('invited'))
      await reload()
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'ALREADY' ? t('alreadyInvited') : t('inviteFailed'))
    }
  }
  const change = async (membershipId: string, body: { role: string } | { remove: true }) => {
    setError(null)
    try {
      await apiFetch(`/api/support/orgs/${id}/members/${membershipId}`, { method: 'PATCH', json: body })
      await reload()
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'LAST_OWNER' ? t('lastOwner') : t('changeFailed'))
    }
  }

  if (!data && loadMessage) return <Card tone="support" className="p-4"><Lead>{loadMessage}</Lead></Card>
  if (!data) return <Spinner />
  const o = data.organization
  const canManage = data.myRole === 'OWNER'
  return (
    <>
      <div className="flex flex-col gap-1">
        <Heading level={2}>{o.name}</Heading>
        <span className="flex gap-1"><Chip color={o.vetting_status === 'APPROVED' ? 'leaf' : 'outline'}>{tStatus(o.vetting_status)}</Chip></span>
      </div>
      {canManage && o.supporter && <OrgPhotoEditor id={id} name={o.name} photoUrl={o.photoUrl} onSaved={reload} />}
      {canManage && <Profile id={id} o={o} onSaved={reload} />}
      <ServiceAreas id={id} areas={data.areas} canEdit={canManage} onSaved={reload} />
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between"><SectionLabel>{t('members')}</SectionLabel><Tip label={t('membersTipLabel')}>{t('membersTip')}</Tip></div>
        {data.members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0">
            <span className="text-t14">{m.displayName}{m.isMe ? ` ${t('me')}` : ''}</span>
            <span className="flex items-center gap-2">
              {canManage && !m.isMe ? (
                <>
                  <select value={m.role} onChange={(e) => void change(m.id, { role: e.target.value })} className="min-h-[44px] rounded-tool border border-line-strong bg-paper px-2 text-t13">
                    {(['OWNER', 'MEMBER'] as const).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
                  </select>
                  <Button tone="support" variant="quiet" className="min-h-[44px] text-t12_5" onClick={() => void change(m.id, { remove: true })}>{t('remove')}</Button>
                </>
              ) : <Chip>{t(`role.${m.role}`)}</Chip>}
            </span>
          </div>
        ))}
      </Card>
      {canManage && (
        <Card tone="support" className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between"><SectionLabel>{t('invite')}</SectionLabel><Tip label={t('inviteTipLabel')}>{t('inviteTip')}</Tip></div>
          <TextField label={t('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {/* 管理とメンバーの違いは、選ぶところの i で出す(11/11 代表の Staging メモ 4) */}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between">
              <span className="text-t13 font-bold">{t('inviteRole')}</span>
              <Tip label={t('rolesTipLabel')}>{t('rolesTip')}</Tip>
            </span>
            <select value={role} onChange={(e) => setRole(e.target.value === 'OWNER' ? 'OWNER' : 'MEMBER')} className="min-h-[44px] rounded-tool border border-line-strong bg-paper px-2 text-t14">
              <option value="MEMBER">{t('role.MEMBER')}</option>
              <option value="OWNER">{t('role.OWNER')}</option>
            </select>
          </label>
          <Button tone="support" variant="night" disabled={!email.trim()} onClick={() => void invite()}>{t('sendInvite')}</Button>
          {data.invitations.length > 0 && <span className="text-t12_5 text-mist">{t('pendingInvites', { count: data.invitations.length })}</span>}
        </Card>
      )}
      {notice && <Card tone="support" className="bg-leaf-soft p-3"><span className="text-t13 font-bold text-leaf-ink">{notice}</span></Card>}
      <ErrorNote>{error ?? loadMessage}</ErrorNote>
      <span className="px-1 text-t11_5 text-mist">{t('displayId', { id: o.display_id })}</span>
    </>
  )
}

export default function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <RequireMe>{() => <AppFrame tone="support"><Org id={id} /></AppFrame>}</RequireMe>
}
