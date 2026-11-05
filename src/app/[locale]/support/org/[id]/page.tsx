'use client'

// 団体のページ(紹介・連絡先・メンバー・招待)。管理の人だけが変えられる。見出しは団体名にし、団体の番号は下に小さく(画面の見直し 所見 12)
import { use, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch, ApiError } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Button, Card, Chip, ErrorNote, Heading, Lead, SectionLabel, Spinner, TextArea, TextField, Tip } from '@/components/app/ui'

type Payload = {
  organization: { id: string; display_id: string; name: string; org_type: string; vetting_status: string; bio: string | null; contact_email: string | null; population: number | null }
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  members: { id: string; role: string; status: string; displayName: string; isMe: boolean }[]
  invitations: { id: string; email: string; role: string }[]
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
      {message && <span className="text-[12.5px] font-bold text-ink-soft">{message}</span>}
    </Card>
  )
}

function Org({ id }: { id: string }) {
  const t = useTranslations('support.org')
  const tStatus = useTranslations('support.vetting')
  const [data, setData] = useState<Payload | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { setData(await apiFetch<Payload>(`/api/support/orgs/${id}`)) } catch { setError(t('notFound')) }
  }, [id, t])
  useEffect(() => { void load() }, [load])

  const invite = async () => {
    setError(null)
    setNotice(null)
    try {
      await apiFetch(`/api/support/orgs/${id}/invitations`, { method: 'POST', json: { email, role } })
      setEmail('')
      setNotice(t('invited'))
      await load()
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'ALREADY' ? t('alreadyInvited') : t('inviteFailed'))
    }
  }
  const change = async (membershipId: string, body: { role: string } | { remove: true }) => {
    setError(null)
    try {
      await apiFetch(`/api/support/orgs/${id}/members/${membershipId}`, { method: 'PATCH', json: body })
      await load()
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'LAST_OWNER' ? t('lastOwner') : t('changeFailed'))
    }
  }

  if (error && !data) return <Card tone="support" className="p-4"><Lead>{error}</Lead></Card>
  if (!data) return <Spinner />
  const o = data.organization
  const canManage = data.myRole === 'OWNER'
  const canInvite = data.myRole === 'OWNER' || data.myRole === 'ADMIN'
  return (
    <>
      <div className="flex flex-col gap-1">
        <Heading level={2}>{o.name}</Heading>
        <span className="flex gap-1"><Chip color={o.vetting_status === 'APPROVED' ? 'leaf' : 'outline'}>{tStatus(o.vetting_status)}</Chip></span>
      </div>
      {canManage && <Profile id={id} o={o} onSaved={load} />}
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between"><SectionLabel>{t('members')}</SectionLabel><Tip label={t('membersTipLabel')}>{t('membersTip')}</Tip></div>
        {data.members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0">
            <span className="text-[14px]">{m.displayName}{m.isMe ? ` ${t('me')}` : ''}</span>
            <span className="flex items-center gap-2">
              {canManage && !m.isMe ? (
                <>
                  <select value={m.role} onChange={(e) => void change(m.id, { role: e.target.value })} className="min-h-[44px] rounded-tool border border-line-strong bg-paper px-2 text-[13px]">
                    {(['OWNER', 'ADMIN', 'MEMBER'] as const).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
                  </select>
                  <Button tone="support" variant="quiet" className="min-h-[44px] text-[12.5px]" onClick={() => void change(m.id, { remove: true })}>{t('remove')}</Button>
                </>
              ) : <Chip>{t(`role.${m.role}`)}</Chip>}
            </span>
          </div>
        ))}
      </Card>
      {canInvite && (
        <Card tone="support" className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between"><SectionLabel>{t('invite')}</SectionLabel><Tip label={t('inviteTipLabel')}>{t('inviteTip')}</Tip></div>
          <TextField label={t('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {data.myRole === 'OWNER' && (
            <select value={role} onChange={(e) => setRole(e.target.value === 'ADMIN' ? 'ADMIN' : 'MEMBER')} className="min-h-[44px] rounded-tool border border-line-strong bg-paper px-2 text-[14px]">
              <option value="MEMBER">{t('role.MEMBER')}</option>
              <option value="ADMIN">{t('role.ADMIN')}</option>
            </select>
          )}
          <Button tone="support" variant="night" disabled={!email.trim()} onClick={() => void invite()}>{t('sendInvite')}</Button>
          {data.invitations.length > 0 && <span className="text-[12.5px] text-mist">{t('pendingInvites', { count: data.invitations.length })}</span>}
        </Card>
      )}
      {notice && <Card tone="support" className="bg-leaf-soft p-3"><span className="text-[13px] font-bold text-leaf-ink">{notice}</span></Card>}
      <ErrorNote>{error}</ErrorNote>
      <span className="px-1 text-[11.5px] text-mist">{t('displayId', { id: o.display_id })}</span>
    </>
  )
}

export default function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <RequireMe>{() => <AppFrame tone="support"><Org id={id} /></AppFrame>}</RequireMe>
}
