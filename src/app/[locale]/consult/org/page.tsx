'use client'

// 会社・地域として相談する(盤 16・05b・05c)。先に相談を書き、届けるときにどの会社・地域として届けるかを選ぶ(なければその場で登録する)。
// 登録したもの(相談者の会社・地域。DB では application.purpose = CONSULT の organizations)は支援団体ではない(#131・#135)。画面では「団体」と書かない。
// 登録もログインも先に求めない(2026-11-17 岡本さん)。ログインは届けるところで求め、戻ってきたら選ぶ段から続ける。相談者として会社・地域の名前が出る。担当者の呼び名は出ない
import { Suspense, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/client/api'
import { canConsultAs, type SubjectType } from '@/lib/domain/intake'
import { canConsultAsOrganization } from '@/lib/domain/orgVetting'
import { AppFrame } from '@/components/app/AppShell'
import { OptionalMe } from '@/components/app/RequireMe'
import { useSession } from '@/components/app/SessionProvider'
import { Button, Card, ErrorNote, Heading, Lead, TextField, Tip } from '@/components/app/ui'
import { WriteFlow } from '@/components/consult/WriteFlow'
import type { MeOrganizationFace } from '@/lib/client/meTypes'

function RegisterOrg({ subject, country, regionCode, sending, onDone }: { subject: SubjectType; sending: boolean; country: string; regionCode: string | null; onDone: (organizationId: string) => Promise<void> }) {
  const t = useTranslations('consult.org')
  const [name, setName] = useState('')
  const [orgType, setOrgType] = useState(subject === 'COMPANY' ? 'COMPANY' : 'MUNICIPALITY')
  const [population, setPopulation] = useState('')
  const [corporateNumber, setCorporateNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!name.trim()) {
      setError(t('nameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    let created: { id: string }
    try {
      created = await apiFetch<{ id: string }>('/api/orgs', {
        method: 'POST',
        json: {
          name,
          orgType,
          purpose: 'CONSULT',
          country,
          regionCode,
          population: population ? Number(population) : null,
          corporateNumber: corporateNumber || null,
        },
      })
    } catch {
      setError(t('registerFailed'))
      setBusy(false)
      return
    }
    setBusy(false)
    // 登録できたら、そのまま相談を届ける
    await onDone(created.id)
  }
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-t15 font-bold">{subject === 'COMPANY' ? t('registerTitleCompany') : t('registerTitleCommunity')}</span>
        <Tip label={t('registerTipLabel')}>{t('registerTip')}</Tip>
      </div>
      <TextField label={subject === 'COMPANY' ? t('companyName') : t('communityName')} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      {subject === 'COMMUNITY' && (
        <label className="flex flex-col gap-1.5">
          <span className="text-t13 font-bold">{t('communityType')}</span>
          <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-t16">
            <option value="MUNICIPALITY">{t('municipality')}</option>
            <option value="COMMUNITY">{t('communityGroup')}</option>
          </select>
        </label>
      )}
      <TextField
        label={subject === 'COMPANY' ? t('employees') : t('residents')}
        hint={t('populationHint')}
        inputMode="numeric"
        value={population}
        onChange={(e) => setPopulation(e.target.value.replace(/[^0-9]/g, ''))}
        className="max-w-[220px]"
      />
      {subject === 'COMPANY' && country === 'JP' && (
        <TextField label={t('corporateNumber')} hint={t('optional')} inputMode="numeric" maxLength={13} value={corporateNumber} onChange={(e) => setCorporateNumber(e.target.value.replace(/[^0-9]/g, ''))} />
      )}
      <ErrorNote>{error}</ErrorNote>
      <Button variant="night" disabled={busy || sending} onClick={() => void submit()}>{t('registerAndSend')}</Button>
    </Card>
  )
}

function Inner() {
  const params = useSearchParams()
  const subject: SubjectType = params.get('subject') === 'COMMUNITY' ? 'COMMUNITY' : 'COMPANY'
  const { refresh } = useSession()
  return (
    <OptionalMe>
      {(me) => {
        const candidates = me ? me.faces.organizations.filter((o) => canConsultAs(subject, o.orgType) && canConsultAsOrganization(o.vettingStatus)) : []
        return (
          <AppFrame tabs={false}>
            <WriteFlow
              subject={subject}
              entryCode={params.get('shop')}
              signedIn={me !== null}
              // 会社・地域を選ぶ段はログインのあとにだけ出る(ログインしていなければ、その手前でログインへ進む)
              organizationStep={({ send, busy }) => me && (
                <OrgStep
                  subject={subject}
                  candidates={candidates}
                  send={send}
                  busy={busy}
                  renderRegister={(onRegistered) => (
                    <RegisterOrg subject={subject} country={me.person.country} regionCode={me.person.regionCode} sending={busy} onDone={onRegistered} />
                  )}
                  refresh={refresh}
                />
              )}
            />
          </AppFrame>
        )
      }}
    </OptionalMe>
  )
}

// 届ける会社・地域を選ぶ。所属しているものがあれば選んで届け、なければ登録してそのまま届ける
function OrgStep({ subject, candidates, send, busy, renderRegister, refresh }: {
  subject: SubjectType
  candidates: MeOrganizationFace[]
  send: (organizationId: string) => Promise<boolean>
  busy: boolean
  renderRegister: (onRegistered: (organizationId: string) => Promise<void>) => React.ReactNode
  refresh: () => Promise<void>
}) {
  const t = useTranslations('consult.org')
  const tWrite = useTranslations('consult.write')
  const sorted = useMemo(() => [...candidates].sort((a, b) => a.organizationName.localeCompare(b.organizationName)), [candidates])
  const [picked, setPicked] = useState<string | null>(sorted.length === 1 ? sorted[0].organizationId : null)
  const [registering, setRegistering] = useState(sorted.length === 0)
  const onRegistered = async (organizationId: string) => {
    const sent = await send(organizationId)
    if (sent) return
    // 届けられなかったとき(上限など)は、登録したものを一覧に出して選んだ状態にしておく
    await refresh()
    setPicked(organizationId)
    setRegistering(false)
  }
  return (
    <div className="flex flex-col gap-4">
      <Heading level={2}>{subject === 'COMPANY' ? t('whichCompany') : t('whichCommunity')}</Heading>
      <Lead>{subject === 'COMPANY' ? t('leadCompany') : t('leadCommunity')}</Lead>
      {sorted.length > 0 && (
        <div role="radiogroup" aria-label={t('which')} className="flex flex-col gap-2">
          {sorted.map((o) => {
            const on = picked === o.organizationId && !registering
            return (
              <button
                key={o.organizationId}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => { setPicked(o.organizationId); setRegistering(false) }}
                className={`flex min-h-[56px] items-center justify-between rounded-[16px] border px-4 text-left ${on ? 'border-night bg-lamp-faint' : 'border-line bg-paper'}`}
              >
                <span className="text-t15 font-bold">{o.organizationName}</span>
                <span aria-hidden className={`h-5 w-5 rounded-full border-2 ${on ? 'border-night bg-night' : 'border-line-strong'}`} />
              </button>
            )
          })}
        </div>
      )}
      {registering ? renderRegister(onRegistered) : (
        <>
          <Button variant="night" disabled={busy || !picked} onClick={() => { if (picked) void send(picked) }}>{tWrite('send')}</Button>
          <Button variant="outline" onClick={() => setRegistering(true)}>{subject === 'COMPANY' ? t('registerAnotherCompany') : t('registerAnotherCommunity')}</Button>
        </>
      )}
    </div>
  )
}

export default function ConsultOrgPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
