'use client'

// 会社・地域として相談する(盤 16・05b・05c)。どの団体として相談するかを選び、なければその場で登録する。
// 相談した団体として団体の名前が出る。担当者の呼び名は出ない
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

function RegisterOrg({ subject, country, regionCode, onDone }: { subject: SubjectType; country: string; regionCode: string | null; onDone: () => Promise<void> }) {
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
    try {
      await apiFetch('/api/orgs', {
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
      await onDone()
    } catch {
      setError(t('registerFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-bold">{t('registerTitle')}</span>
        <Tip label={t('registerTipLabel')}>{t('registerTip')}</Tip>
      </div>
      <TextField label={subject === 'COMPANY' ? t('companyName') : t('communityName')} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      {subject === 'COMMUNITY' && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">{t('communityType')}</span>
          <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px]">
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
      <Button variant="night" disabled={busy} onClick={() => void submit()}>{t('register')}</Button>
    </Card>
  )
}

function Inner() {
  const t = useTranslations('consult.org')
  const params = useSearchParams()
  const subject: SubjectType = params.get('subject') === 'COMMUNITY' ? 'COMMUNITY' : 'COMPANY'
  const { refresh } = useSession()
  const [picked, setPicked] = useState<MeOrganizationFace | null>(null)
  const [registering, setRegistering] = useState(false)
  return (
    <RequireMe>
      {(me) => {
        const candidates = me.faces.organizations.filter((o) => canConsultAs(subject, o.orgType) && !['REJECTED', 'SUSPENDED'].includes(o.vettingStatus))
        return (
          <AppFrame tabs={false}>
            {picked ? (
              <WriteFlow subject={subject} organizationId={picked.organizationId} organizationName={picked.organizationName} country={me.person.country} entryCode={params.get('shop')} />
            ) : (
              <OrgChooser
                subject={subject}
                candidates={candidates}
                onPick={setPicked}
                registering={registering}
                setRegistering={setRegistering}
                register={<RegisterOrg subject={subject} country={me.person.country} regionCode={me.person.regionCode} onDone={async () => { await refresh(); setRegistering(false) }} />}
                title={subject === 'COMPANY' ? t('titleCompany') : t('titleCommunity')}
              />
            )}
          </AppFrame>
        )
      }}
    </RequireMe>
  )
}

function OrgChooser({ subject, candidates, onPick, registering, setRegistering, register, title }: {
  subject: SubjectType
  candidates: MeOrganizationFace[]
  onPick: (o: MeOrganizationFace) => void
  registering: boolean
  setRegistering: (v: boolean) => void
  register: React.ReactNode
  title: string
}) {
  const t = useTranslations('consult.org')
  const sorted = useMemo(() => [...candidates].sort((a, b) => a.organizationName.localeCompare(b.organizationName)), [candidates])
  return (
    <div className="flex flex-col gap-4">
      <Heading level={2}>{title}</Heading>
      <Lead>{subject === 'COMPANY' ? t('leadCompany') : t('leadCommunity')}</Lead>
      {sorted.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="px-1 text-[12.5px] font-bold text-mist">{t('which')}</span>
          {sorted.map((o) => (
            <button key={o.organizationId} type="button" onClick={() => onPick(o)} className="flex min-h-[56px] items-center justify-between rounded-[16px] border border-line bg-paper px-4 text-left">
              <span className="text-[15px] font-bold">{o.organizationName}</span>
              <span aria-hidden>›</span>
            </button>
          ))}
        </div>
      )}
      {registering ? register : (
        <Button variant="outline" onClick={() => setRegistering(true)}>{sorted.length > 0 ? t('registerAnother') : t('registerFirst')}</Button>
      )}
    </div>
  )
}

export default function ConsultOrgPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
