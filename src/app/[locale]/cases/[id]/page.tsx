'use client'

// 相談のホーム(盤 13)・申し出を選ぶ(盤 14)・一緒に進める(盤 15)・解決の確定とありがとう。
// 画面は相談の「いま」を映す。決めるのは本人で、大きな行動は1画面に1つ(設計原則 1・2)
import { Suspense, use, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/client/api'
import { Link } from '@/i18n/navigation'
import { THANKS_WORDS, type ThanksWord } from '@/lib/domain/offers'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Button, Card, Chip, cx, ErrorNote, Heading, Lead, SectionLabel, Spinner, Tip } from '@/components/app/ui'
import { Thread } from '@/components/thread/Thread'
import { Referrals } from '@/components/consult/Referrals'
import { CrisisLinks } from '@/components/app/CrisisLinks'
import { useSession } from '@/components/app/SessionProvider'
import type { ConsulteeCaseView, ConsulteeOffer } from '@/lib/server/consulteeView'

type Payload = { case: ConsulteeCaseView; canDecide: boolean }

function Steps({ c }: { c: ConsulteeCaseView }) {
  const t = useTranslations('consult.case')
  const pending = c.offers.some((o) => o.status === 'PENDING')
  const stage = c.status === 'RESOLVED' ? 4 : c.status === 'MATCHED' ? 3 : pending ? 2 : 1
  const labels = ['written', 'delivered', 'offers', 'together', 'resolved'] as const
  return (
    <ol className="m-0 flex list-none gap-1 p-0" aria-label={t('stepsLabel')}>
      {labels.map((key, i) => (
        <li key={key} className="flex flex-1 flex-col items-center gap-1">
          <span className={cx('h-1.5 w-full rounded-full', i <= stage ? 'bg-night' : 'bg-line')} />
          <span className={cx('text-[11px]', i === stage ? 'font-bold text-ink' : 'text-mist')} aria-current={i === stage ? 'step' : undefined}>{t(`steps.${key}`)}</span>
        </li>
      ))}
    </ol>
  )
}

function OfferCard({ offer, canChoose, full, onAct }: { offer: ConsulteeOffer; canChoose: boolean; full: boolean; onAct: (action: 'accept' | 'decline') => Promise<void> }) {
  const t = useTranslations('consult.offers')
  const [busy, setBusy] = useState(false)
  const act = async (a: 'accept' | 'decline') => {
    setBusy(true)
    try { await onAct(a) } finally { setBusy(false) }
  }
  const chosen = offer.status === 'ACCEPTED'
  return (
    <Card className={cx('flex flex-col gap-3 p-4', chosen && 'border-2 border-night')}>
      <div className="flex items-center gap-3">
        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center text-[16px] font-bold', offer.kind === 'ORGANIZATION' ? 'rounded-[12px] bg-night text-lamp' : 'rounded-full bg-dawn-soft text-dawn-ink')} aria-hidden>
          {offer.name.slice(0, 1)}
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="text-[15px] font-bold">{offer.kind === 'INDIVIDUAL' ? t('individualName', { name: offer.name }) : offer.name}</span>
          <span className="flex flex-wrap gap-1">
            <Chip color={offer.kind === 'ORGANIZATION' ? 'steel' : 'dawn'}>{offer.kind === 'ORGANIZATION' ? t('organization') : t('individual')}</Chip>
            {offer.approved && <Chip color="leaf">{t('interviewed')}</Chip>}
            {offer.phoneVerified && <Chip color="leaf">{t('phoneVerified')}</Chip>}
            {offer.remoteOk && <Chip>{t('remote')}</Chip>}
            {chosen && offer.acceptedOrder === 1 && <Chip color="night">{t('lead')}</Chip>}
          </span>
        </span>
      </div>
      {offer.invitedByName && <p className="m-0 text-[12.5px] text-dawn-ink">{t('invitedBy', { name: offer.invitedByName })}</p>}
      <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.75] text-ink-soft">{offer.message}</p>
      {chosen ? (
        <span className="text-[13px] font-bold text-dawn">{offer.acceptedOrder === 1 ? t('chosenLead') : t('chosenTogether')}</span>
      ) : canChoose ? (
        <div className="flex gap-2">
          <Button variant="lamp" disabled={busy || full} onClick={() => void act('accept')} className="flex-1">{offer.invitedByName ? t('agreeInvite') : t('choose')}</Button>
          <Button variant="outline" disabled={busy} onClick={() => void act('decline')}>{t('pass')}</Button>
        </div>
      ) : null}
    </Card>
  )
}

function ResolvePanel({ caseId, onDone }: { caseId: string; onDone: () => Promise<void> }) {
  const t = useTranslations('consult.resolve')
  const tBadge = useTranslations('sdgs.badge')
  const [words, setWords] = useState<ThanksWord[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = async (action: 'confirmResolved' | 'notYet') => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/api/cases/${caseId}/actions`, { method: 'POST', json: { action, thanks: action === 'confirmResolved' ? words : undefined } })
      await onDone()
    } catch {
      setError(t('failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="flex flex-col gap-3 border-2 border-lamp p-4">
      <span className="text-[16px] font-bold">{t('title')}</span>
      <Lead>{t('lead')}</Lead>
      <SectionLabel>{t('thanks')}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {THANKS_WORDS.map((w) => {
          const on = words.includes(w)
          return (
            <button key={w} type="button" aria-pressed={on} onClick={() => setWords(on ? words.filter((x) => x !== w) : [...words, w])} className={cx('min-h-[40px] rounded-full px-3 text-[13px] font-bold', on ? 'bg-lamp text-ink' : 'border border-line-strong bg-paper text-ink-soft')}>
              {tBadge(w)}
            </button>
          )
        })}
      </div>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="night" disabled={busy} onClick={() => void act('confirmResolved')}>{t('confirm')}</Button>
      <Button variant="outline" disabled={busy} onClick={() => void act('notYet')}>{t('notYet')}</Button>
    </Card>
  )
}

function CaseInner({ id }: { id: string }) {
  const t = useTranslations('consult.case')
  const tOffers = useTranslations('consult.offers')
  const { state: session } = useSession()
  const country = session.status === 'ready' ? session.me.person.country : null
  const params = useSearchParams()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Payload>(`/api/cases/${id}`))
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? t('notFound') : t('loadFailed'))
    }
  }, [id, t])
  useEffect(() => { void load() }, [load])

  const actOnOffer = async (offerId: string, action: 'accept' | 'decline') => {
    setError(null)
    try {
      await apiFetch(`/api/cases/${id}/offers/${offerId}`, { method: 'POST', json: { action } })
      await load()
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'MAX_REACHED' ? tOffers('full') : tOffers('failed'))
    }
  }
  const cancel = async () => {
    try {
      await apiFetch(`/api/cases/${id}/actions`, { method: 'POST', json: { action: 'cancel' } })
      setCancelOpen(false)
      await load()
    } catch {
      setError(t('cancelFailed'))
    }
  }

  if (error && !data) return <Card className="p-4"><Lead>{error}</Lead></Card>
  if (!data) return <Spinner />
  const c = data.case
  const open = c.status === 'OPEN' || c.status === 'MATCHED'
  const waiting = c.offers.filter((o) => o.status === 'PENDING')
  const chosen = c.offers.filter((o) => o.status === 'ACCEPTED')
  const full = c.acceptedCount >= c.maxSupporters

  return (
    <>
      <div className="flex flex-col gap-1 px-1">
        <span className="text-[12px] text-mist">{c.subjectName ? t('subjectOrg', { name: c.subjectName }) : t('subjectMine')}</span>
        <Heading level={2}>{c.title}</Heading>
      </div>
      <Steps c={c} />
      {/* 緊急の印が付いた相談は、受付のあいだ、いますぐ話せる窓口を出しておく(行き止まりを作らない) */}
      {c.urgent && open && <CrisisLinks country={country} />}

      {params.get('sent') === '1' && c.status === 'OPEN' && (
        <Card className="flex flex-col gap-1 bg-lamp-faint p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">{t('delivered')}</span>
            <Tip label={t('deliveredTipLabel')}>{c.isMinor ? t('deliveredTipMinor') : t('deliveredTip')}</Tip>
          </div>
          <Lead>{t('deliveredLead')}</Lead>
        </Card>
      )}

      {/* いまの段階で次にすること(画面の見直し 所見 6) */}
      {c.status === 'OPEN' && waiting.length === 0 && params.get('sent') !== '1' && <Lead>{t('nextOpen')}</Lead>}
      {c.status === 'MATCHED' && c.supporterResolvedAt && data.canDecide && <ResolvePanel caseId={c.id} onDone={load} />}
      {c.status === 'RESOLVED' && <Card className="bg-leaf-soft p-4"><span className="text-[15px] font-bold text-leaf-ink">{t('resolved')}</span></Card>}

      {waiting.length > 0 && open && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[15px] font-bold">{tOffers('arrived', { count: waiting.length })}</span>
            <Tip label={tOffers('tipLabel')}>{tOffers('tip')}</Tip>
          </div>
          <span className="px-1 text-[12.5px] text-mist">{tOffers('upTo', { max: c.maxSupporters, count: c.acceptedCount })}</span>
          {waiting.map((o) => <OfferCard key={o.id} offer={o} canChoose={data.canDecide} full={full} onAct={(a) => actOnOffer(o.id, a)} />)}
        </section>
      )}

      {chosen.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>{c.status === 'RESOLVED' ? t('togetherDone') : t('together')}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {chosen.map((o) => <Chip key={o.id} color={o.acceptedOrder === 1 ? 'night' : 'dawn'}>{o.name}{o.acceptedOrder === 1 ? ` ・ ${tOffers('lead')}` : ''}</Chip>)}
          </div>
          {/* 相談の状態が変わったら(解決・取り消し)、やりとりを読み直して入力欄を閉じる */}
          <Thread key={c.status} caseId={c.id} />
        </section>
      )}

      {c.status === 'OPEN' && <Referrals caseId={c.id} canDecide={data.canDecide} consented={c.consentedReferralIds} />}

      <Card className="flex flex-col gap-2 p-4">
        <SectionLabel>{t('whatYouWrote')}</SectionLabel>
        {c.indicatorTexts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{c.indicatorTexts.map((text) => <Chip key={text} color="lamp">{text}</Chip>)}</div>
        )}
        <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.75]">{c.description}</p>
      </Card>

      {c.status === 'OPEN' && <Link href="/me" className="px-1 text-[13px] text-night">{t('notifyMe')}</Link>}

      {open && data.canDecide && (
        cancelOpen ? (
          <Card className="flex flex-col gap-2 p-4">
            <Lead>{t('cancelConfirm')}</Lead>
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => void cancel()} className="flex-1">{t('cancelYes')}</Button>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>{t('back')}</Button>
            </div>
          </Card>
        ) : (
          <button type="button" onClick={() => setCancelOpen(true)} className="self-start min-h-[44px] px-1 text-[12.5px] text-mist underline">{c.status === 'MATCHED' ? t('cancelMatched') : t('cancel')}</button>
        )
      )}
      <ErrorNote>{error}</ErrorNote>
    </>
  )
}

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequireMe>
      {() => (
        <AppFrame>
          <Suspense fallback={<Spinner />}>
            <CaseInner id={id} />
          </Suspense>
        </AppFrame>
      )}
    </RequireMe>
  )
}
