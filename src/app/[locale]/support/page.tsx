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
  // 顔の key(文字列)で読み直す。/api/me を読み直すたびに顔の中身が作り直されても、同じ顔なら読み直さない
  const faceKey = current?.key ?? null
  const coordinator = current?.coordinator === true
  // 審査中の団体には相談が見えず、代理の登録もできない(visibility.ts・/api/support/proxy)
  const pendingOrg = current?.kind === 'ORGANIZATION' && !current.approved
  useEffect(() => {
    if (!faceKey) return
    const face = encodeURIComponent(faceKey)
    apiFetch<{ cases: SupportCaseItem[] }>(`/api/support/involved?face=${face}`).then((d) => setInvolved(d.cases)).catch(() => setInvolved([]))
    apiFetch<{ cases: SupportCaseItem[] }>(`/api/support/cases?face=${face}&involvement=notOffered`).then((d) => setFresh(d.cases.slice(0, 3))).catch(() => setFresh([]))
    // コーディネーターの団体だけ、その地域で 24 時間申し出のない相談を読む(ほかの顔では読まない)
    if (!coordinator) return
    apiFetch<{ cases: SupportCaseItem[]; face: { coordinator?: boolean } }>(`/api/support/cases?face=${face}&escalated=1&involvement=all`).then((d) => setUnmatched(d.face.coordinator ? d.cases : null)).catch(() => setUnmatched(null))
  }, [faceKey, coordinator])

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
        <Link href="/support/join" className="text-t15 font-bold text-night">{t('join')}</Link>
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
      {pendingOrg && <Card tone="support" className="p-4"><Lead>{t('appliedNote')}</Lead></Card>}
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
      {coordinator && unmatched && (
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
        {fresh && fresh.length === 0 && <p className="m-0 px-1 text-t13 text-mist">{pendingOrg ? t('noneUntilApproved') : t('noneForYou')}</p>}
        {(fresh ?? []).map((c) => <CaseCard key={c.id} item={c} face={current?.key ?? ""} />)}
        {/* 一覧への入口は、文字だけのリンクでなくボタンで出す(11/13 代表の Staging メモ 9) */}
        <Link href="/support/find" className="flex min-h-[52px] items-center justify-center gap-2 rounded-tool bg-night px-4 text-t15 font-bold tracking-[0.2em] text-white no-underline">
          {t('findMore')}<span aria-hidden>›</span>
        </Link>
      </section>
      <Link href="/support/contributions" className="no-underline">
        <Card tone="support" className="flex items-center justify-between p-4 text-ink">
          <span className="text-t14_5 font-bold">{t('contributions')}</span><span aria-hidden>›</span>
        </Card>
      </Link>
      {current?.kind === 'ORGANIZATION' && (
        <div className="grid grid-cols-2 gap-2">
          {/* 代理の登録は承認された団体だけ(API も断る)。審査中は押せない形で出し、いつ使えるかを書く(11/11 代表の Staging メモ 3) */}
          {pendingOrg ? (
            <Card tone="support" aria-disabled className="flex flex-col gap-0.5 p-3 text-center opacity-60">
              <span className="text-t13_5 font-bold tracking-[0.2em] text-ink">{t('proxy')}</span>
              <span className="text-t11_5 text-ink-soft">{t('proxyAfterInterview')}</span>
            </Card>
          ) : (
            <Link href={`/support/proxy?face=${encodeURIComponent(current.key)}`} className="no-underline"><Card tone="support" className="p-3 text-center text-t13_5 font-bold tracking-[0.2em] text-ink">{t('proxy')}</Card></Link>
          )}
          <Link href={`/support/org/${current.organizationId}`} className="no-underline"><Card tone="support" className="p-3 text-center text-t13_5 font-bold tracking-[0.2em] text-ink">{t('orgPage')}</Card></Link>
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
