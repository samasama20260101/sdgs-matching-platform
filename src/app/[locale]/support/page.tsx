'use client'

// 支える｜ホーム(盤 20): 一番上に「あなたの番」(返す番のやりとり・招かれた相談)、あなたに合う新しい相談(画面の見直し 所見 7)
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { apiFetch } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, Chip, Heading, Lead, SectionLabel, Tip } from '@/components/app/ui'
import { CaseCard } from '@/components/support/CaseCard'
import { FacePicker, useFace } from '@/components/support/useFace'
import { Invitations } from '@/components/support/Invitations'
import { TalkRow } from '@/components/thread/TalkRow'
import { sortTalks, talkTurn } from '@/lib/domain/talk'
import type { SupportCaseItem } from '@/lib/server/supportCases'

function Home() {
  const t = useTranslations('support.home')
  const { options, current, choose } = useFace()
  const [involved, setInvolved] = useState<SupportCaseItem[] | null>(null)
  const [fresh, setFresh] = useState<SupportCaseItem[] | null>(null)
  const [unmatched, setUnmatched] = useState<SupportCaseItem[] | null>(null)
  useEffect(() => {
    if (!current) return
    const face = encodeURIComponent(current.key)
    apiFetch<{ cases: SupportCaseItem[] }>(`/api/support/involved?face=${face}`).then((d) => setInvolved(d.cases)).catch(() => setInvolved([]))
    apiFetch<{ cases: SupportCaseItem[] }>(`/api/support/cases?face=${face}&involvement=notOffered`).then((d) => setFresh(d.cases.slice(0, 3))).catch(() => setFresh([]))
    // コーディネーターの団体なら、その地域で 24 時間申し出のない相談
    apiFetch<{ cases: SupportCaseItem[]; face: { coordinator?: boolean } }>(`/api/support/cases?face=${face}&escalated=1&involvement=all`).then((d) => setUnmatched(d.face.coordinator ? d.cases : null)).catch(() => setUnmatched(null))
  }, [current])

  const visible = sortTalks((involved ?? []).filter((c) => !c.locked), 'SUPPORTER')
  const isTurn = (c: SupportCaseItem) => c.myOfferStatus === 'INVITED' || (c.status === 'MATCHED' && talkTurn(c.lastMessage, 'SUPPORTER') === 'mine')
  const turn = visible.filter(isTurn)
  const others = visible.filter((c) => !isTurn(c))
  if (options.length === 0) {
    return (
      <>
      <Invitations />
      <Card tone="support" className="flex flex-col gap-3 p-4">
        <Lead>{t('noFace')}</Lead>
        <Link href="/support/join" className="text-[15px] font-bold text-night">{t('join')}</Link>
      </Card>
      </>
    )
  }
  return (
    <>
      <Invitations />
      <FacePicker options={options} current={current} onChoose={choose} />
      {current && (
        <div className="flex flex-col gap-1">
          <Heading level={2}>{current.kind === 'INDIVIDUAL' ? t('helloIndividual', { name: current.label }) : current.label}</Heading>
          <span className="flex flex-wrap gap-1">
            <Chip color={current.kind === 'INDIVIDUAL' ? 'dawn' : 'steel'}>{current.kind === 'INDIVIDUAL' ? t('individual') : t('organization')}</Chip>
            {current.kind === 'ORGANIZATION' && (current.approved ? <Chip color="leaf">{t('approved')}</Chip> : <Chip color="outline">{t('applied')}</Chip>)}
          </span>
        </div>
      )}
      {current?.kind === 'ORGANIZATION' && !current.approved && <Card tone="support" className="p-4"><Lead>{t('appliedNote')}</Lead></Card>}
      {turn.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>{t('yourTurn', { count: turn.length })}</SectionLabel>
          {turn.map((c) => (
            <TalkRow key={c.id} href={`/support/cases/${c.id}?face=${encodeURIComponent(current?.key ?? '')}`} title={c.title ?? ''} sub={c.myOfferStatus === 'INVITED' ? t('invitedToCase') : c.subjectName} last={c.lastMessage} viewer="SUPPORTER" />
          ))}
        </section>
      )}
      {others.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>{t('involved')}</SectionLabel>
          {others.map((c) => (
            <TalkRow key={c.id} href={`/support/cases/${c.id}?face=${encodeURIComponent(current?.key ?? '')}`} title={c.title ?? ''} sub={c.subjectName} last={c.lastMessage} viewer="SUPPORTER" resolved={c.status === 'RESOLVED'} />
          ))}
        </section>
      )}
      {unmatched && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>{t('unmatched', { count: unmatched.length })}</SectionLabel>
            <Tip label={t('unmatchedTipLabel')}>{t('unmatchedTip')}</Tip>
          </div>
          {unmatched.map((c) => <CaseCard key={c.id} item={c} face={current?.key ?? ''} />)}
        </section>
      )}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>{t('forYou')}</SectionLabel>
          <Tip label={t('forYouTipLabel')}>{t('forYouTip')}</Tip>
        </div>
        {fresh && fresh.length === 0 && <p className="m-0 px-1 text-[13px] text-mist">{t('noneForYou')}</p>}
        {(fresh ?? []).map((c) => <CaseCard key={c.id} item={c} face={current?.key ?? ""} />)}
        <Link href="/support/find" className="px-1 text-[13.5px] font-bold text-night">{t('findMore')}</Link>
      </section>
      <Link href="/support/contributions" className="no-underline">
        <Card tone="support" className="flex items-center justify-between p-4 text-ink">
          <span className="text-[14.5px] font-bold">{t('contributions')}</span><span aria-hidden>›</span>
        </Card>
      </Link>
      {current?.kind === 'ORGANIZATION' && (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/support/proxy?face=${encodeURIComponent(current.key)}`} className="no-underline"><Card tone="support" className="p-3 text-center text-[13.5px] font-bold text-ink">{t('proxy')}</Card></Link>
          <Link href={`/support/org/${current.organizationId}`} className="no-underline"><Card tone="support" className="p-3 text-center text-[13.5px] font-bold text-ink">{t('orgPage')}</Card></Link>
        </div>
      )}
    </>
  )
}

export default function SupportHomePage() {
  return (
    <RequireMe>
      {() => (
        <AppFrame tone="support">
          <Home />
        </AppFrame>
      )}
    </RequireMe>
  )
}
