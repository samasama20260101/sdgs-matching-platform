'use client'

// 会社・地域として相談する(盤 16・05b・05c)。先に相談を書き、届けるときにどの団体として届けるかを選ぶ(なければその場で登録する)。
// 団体の登録を先に求めない(2026-11-17 岡本さん)。相談した団体として団体の名前が出る。担当者の呼び名は出ない
import { Suspense, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/client/api'
import { canConsultAs, type SubjectType } from '@/lib/domain/intake'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
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
        <span className="text-t15 font-bold">{t('registerTitle')}</span>
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
    <RequireMe>
      {(me) => {
        const candidates = me.faces.organizations.filter((o) => canConsultAs(subject, o.orgType) && !['REJECTED', 'SUSPENDED'].includes(o.vettingStatus))
        return (
          <AppFrame tabs={false}>
            <WriteFlow
              subject={subject}
              country={me.person.country}
              entryCode={params.get('shop')}
              organizationStep={({ send, busy }) => (
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
    </RequireMe>
  )
}

// 届ける団体を選ぶ。所属している団体があれば選んで届け、なければ登録してそのまま届ける
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
    // 届けられなかったとき(上限など)は、登録した団体を一覧に出して選んだ状態にしておく
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
          <Button variant="outline" onClick={() => setRegistering(true)}>{t('registerAnother')}</Button>
        </>
      )}
    </div>
  )
}

export default function ConsultOrgPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
