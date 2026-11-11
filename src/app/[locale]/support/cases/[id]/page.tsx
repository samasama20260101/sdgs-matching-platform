'use client'

// 支える｜相談の詳細と申し出(盤 22 から)。選ばれたらやりとり、中心は解決の報告と共同支援の招待
import { Suspense, use, useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { apiFetch, ApiError } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { useIndicatorLabel } from '@/lib/client/indicatorLabel'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Button, Card, Chip, ErrorNote, Heading, Lead, SectionLabel, Spinner, TextArea } from '@/components/app/ui'
import { Thread } from '@/components/thread/Thread'
import type { SupportCaseItem } from '@/lib/server/supportCases'
import { waitingLabel } from '@/lib/domain/schedule'
import { regionText, WaitingText } from '@/components/support/caseText'

type Detail = {
  case: SupportCaseItem & { description: string; since: string | null; wish: string | null; supporterResolvedAt: string | null; createdAt: string }
  myOffer: { id: string; status: string; message: string; acceptedOrder: number | null; invited: boolean } | null
  isLead: boolean
  locked: boolean
}

function OfferForm({ caseId, face, onDone }: { caseId: string; face: string; onDone: () => Promise<void> }) {
  const t = useTranslations('support.case')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/api/support/cases/${caseId}/offer`, { method: 'POST', json: { face, message } })
      await onDone()
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'PHONE_REQUIRED' ? t('phoneRequired') : t('offerFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <TextArea label={t('offerMessage')} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
      <ErrorNote>{error}</ErrorNote>
      <Button tone="support" variant="night" disabled={busy || !message.trim()} onClick={() => void send()}>{t('offer')}</Button>
    </Card>
  )
}

// 申し出られないときは、理由と次にすることを出す(「いまは申し出られません」だけでは分からない。11/11 代表の Staging メモ 6)
function CannotOffer({ block }: { block: SupportCaseItem['offerBlock'] }) {
  const t = useTranslations('support.case')
  if (block === 'PHONE_REQUIRED') {
    return (
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <Lead>{t('cannotOfferPhone')}</Lead>
        <Link href="/support/join" className="text-[14px] font-bold text-night">{t('verifyPhoneLink')}</Link>
      </Card>
    )
  }
  const message = block === 'CLOSED' ? t('cannotOfferClosed') : block === 'MFA_REQUIRED' ? t('cannotOfferMfa') : t('cannotOffer')
  return <Card tone="support" className="p-4"><Lead>{message}</Lead></Card>
}

function InviteForm({ caseId, face }: { caseId: string; face: string }) {
  const t = useTranslations('support.case')
  const [open, setOpen] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [orgs, setOrgs] = useState<{ id: string; organization_name: string }[]>([])
  useEffect(() => {
    if (!open) return
    // 招けるのは運営が承認した団体(公開の一覧と同じ)
    fetch('/api/public/supporters').then((r) => r.json()).then((d: { supporters?: { id: string; organization_name: string }[] }) => setOrgs(d.supporters ?? [])).catch(() => setOrgs([]))
  }, [open])
  if (!open) return <Button tone="support" variant="outline" onClick={() => setOpen(true)}>{t('invite')}</Button>
  const send = async () => {
    setState('busy')
    try {
      await apiFetch(`/api/support/cases/${caseId}/invite`, { method: 'POST', json: { face, targetOrganizationId: orgId.trim(), message } })
      setState('done')
    } catch {
      setState('error')
    }
  }
  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <Lead>{t('inviteLead')}</Lead>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">{t('inviteOrg')}</span>
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px]">
          <option value="">{t('inviteOrgHint')}</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.organization_name}</option>)}
        </select>
      </label>
      <TextArea label={t('inviteMessage')} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
      {state === 'done' ? <span className="text-[13px] font-bold text-leaf">{t('invited')}</span> : (
        <Button tone="support" variant="night" disabled={state === 'busy' || !orgId.trim() || !message.trim()} onClick={() => void send()}>{t('sendInvite')}</Button>
      )}
      {state === 'error' && <ErrorNote>{t('inviteFailed')}</ErrorNote>}
    </Card>
  )
}

function Inner({ id }: { id: string }) {
  const t = useTranslations('support.case')
  const tCard = useTranslations('support.card')
  const tSdgs = useTranslations('sdgs')
  const locale = useLocale()
  const label = useIndicatorLabel()
  const face = useSearchParams().get('face') ?? ''
  const fetchDetail = useCallback(() => apiFetch<Detail>(`/api/support/cases/${id}?face=${encodeURIComponent(face)}`), [id, face])
  const { data, error: loadError, reload } = useLoad(fetchDetail)
  const [error, setError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [reason, setReason] = useState('')

  const loadMessage = loadError ? t('notFound') : null

  const act = async (fn: () => Promise<unknown>, failKey: string) => {
    setError(null)
    try {
      await fn()
      await reload()
    } catch {
      setError(t(failKey))
    }
  }

  if (!data && loadMessage) return <Card tone="support" className="p-4"><Lead>{loadMessage}</Lead></Card>
  if (!data) return <Spinner />
  if (data.locked) return <Card tone="support" className="p-4"><Lead>{t('lockedBody')}</Lead></Card>
  const c = data.case
  const mine = data.myOffer
  const accepted = mine?.status === 'ACCEPTED'

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[12px] text-mist">{c.subjectName ?? (c.subjectType === 'PERSON' ? t('person') : '')}</span>
        <Heading level={2}>{c.title}</Heading>
        {c.areaGoals.length > 0 && <span className="text-[13px] font-bold text-ink-soft">{c.areaGoals.map((g) => tSdgs(`area.${c.subjectType}.${g}`)).join(' / ')}</span>}
        <span className="flex flex-wrap gap-1">
          {c.indicators.map((i) => <Chip key={`${i.source}${i.code}`} color={i.source === 'SELF' ? 'night' : 'outline'}>{i.source === 'AI' ? `AI ${i.code}` : `${i.code} ${label(c.subjectType, i.code) ?? i.text}`}</Chip>)}
          {c.urgent && <Chip color="coral">{tCard('urgent')}</Chip>}
          {c.isMinor && <Chip color="lamp">{tCard('minor')}</Chip>}
          {c.regionCode && <Chip>{regionText(c, locale)}</Chip>}
        </span>
      </div>
      {c.summary && <Card tone="support" className="flex flex-col gap-1 p-4"><SectionLabel>{t('summary')}</SectionLabel><Lead>{c.summary}</Lead></Card>}
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <SectionLabel>{t('words')}</SectionLabel>
        <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.75]">{c.description}</p>
        {c.since && <p className="m-0 text-[13px] text-ink-soft">{t('since')}: {c.since}</p>}
        {c.wish && <p className="m-0 text-[13px] text-ink-soft">{t('wish')}: {c.wish}</p>}
        <span className="text-[12px]"><WaitingText wait={waitingLabel(c.waitingHours)} /></span>
      </Card>

      {mine?.status === 'INVITED' && (
        <Card tone="support" className="flex flex-col gap-2 border-2 border-dawn p-4">
          <span className="text-[14.5px] font-bold">{t('invitation')}</span>
          <Lead>{mine.message}</Lead>
          <div className="flex gap-2">
            <Button tone="support" variant="night" className="flex-1" onClick={() => void act(() => apiFetch(`/api/support/invitations/${mine.id}`, { method: 'POST', json: { face, action: 'accept' } }), 'failed')}>{t('acceptInvitation')}</Button>
            <Button tone="support" variant="outline" onClick={() => void act(() => apiFetch(`/api/support/invitations/${mine.id}`, { method: 'POST', json: { face, action: 'decline' } }), 'failed')}>{t('declineInvitation')}</Button>
          </div>
        </Card>
      )}

      {!mine || ['WITHDRAWN', 'DECLINED'].includes(mine.status) ? (
        c.canOffer ? <OfferForm caseId={c.id} face={face} onDone={reload} /> : <CannotOffer block={c.offerBlock} />
      ) : mine.status === 'PENDING' ? (
        <Card tone="support" className="flex flex-col gap-2 p-4">
          <span className="text-[14px] font-bold">{mine.invited ? t('waitingConsentInvite') : t('pending')}</span>
          <Lead>{mine.message}</Lead>
          <Button tone="support" variant="outline" onClick={() => void act(() => apiFetch(`/api/support/cases/${c.id}/offer`, { method: 'DELETE', json: { face } }), 'failed')}>{t('withdraw')}</Button>
        </Card>
      ) : null}

      {accepted && (
        <section className="flex flex-col gap-3">
          <SectionLabel>{data.isLead ? t('youLead') : t('youTogether')}</SectionLabel>
          <Thread key={c.status} caseId={c.id} tone="support" />
          {data.isLead && c.status === 'MATCHED' && (
            c.supporterResolvedAt
              ? <Card tone="support" className="p-3"><Lead>{t('reported')}</Lead></Card>
              : <Button tone="support" variant="lamp" onClick={() => void act(() => apiFetch(`/api/support/cases/${c.id}/report`, { method: 'POST', json: { face } }), 'failed')}>{t('report')}</Button>
          )}
          {data.isLead && c.status === 'MATCHED' && <InviteForm caseId={c.id} face={face} />}
          {c.status === 'MATCHED' && (
            withdrawing ? (
              <Card tone="support" className="flex flex-col gap-2 p-4">
                <TextArea label={t('withdrawReason')} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button tone="support" variant="danger" disabled={!reason.trim()} className="flex-1" onClick={() => void act(() => apiFetch(`/api/support/cases/${c.id}/offer`, { method: 'DELETE', json: { face, reason } }), 'failed')}>{t('withdraw')}</Button>
                  <Button tone="support" variant="outline" onClick={() => setWithdrawing(false)}>{t('back')}</Button>
                </div>
              </Card>
            ) : <Button tone="support" variant="quiet" className="self-start text-[13px]" onClick={() => setWithdrawing(true)}>{t('withdrawMatched')}</Button>
          )}
        </section>
      )}
      <ErrorNote>{error ?? loadMessage}</ErrorNote>
    </>
  )
}

export default function SupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequireMe>
      {() => (
        <AppFrame tone="support">
          <Suspense fallback={<Spinner />}><Inner id={id} /></Suspense>
        </AppFrame>
      )}
    </RequireMe>
  )
}
