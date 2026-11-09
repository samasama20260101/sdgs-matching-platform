'use client'

// 規約とプライバシーポリシーへの同意(盤 70: 同意の画面には「大きく変わる約束」の要約を出し、全文はリンクにする)
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { apiFetch } from '@/lib/client/api'
import { needsGuardianConsent } from '@/lib/domain/age'
import { GuardianConsentNote } from './GuardianConsentNote'
import { useReadyMe, useSession } from './SessionProvider'
import { Button, Card, ErrorNote, Heading, Lead, Screen } from './ui'

export const CONSENT_POINTS = ['noPersonalInfo', 'whoSees', 'onlyChosen', 'records', 'roles', 'providers'] as const

export function ConsentSummary() {
  const t = useTranslations('app.consent')
  return (
    <Card className="p-4">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {CONSENT_POINTS.map((key, i) => (
          <li key={key} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-night text-[12px] font-bold text-lamp">{i + 1}</span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-bold">{t(`points.${key}.title`)}</span>
              <span className="text-[12.5px] leading-[1.7] text-ink-soft">{t(`points.${key}.body`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="m-0 mt-3 text-[12.5px] text-mist">
        <Link href="/terms" className="text-night">{t('terms')}</Link>
        {' ・ '}
        <Link href="/privacy" className="text-night">{t('privacy')}</Link>
      </p>
    </Card>
  )
}

export function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const t = useTranslations('app.consent')
  return (
    <label className="flex min-h-[48px] items-center gap-3 rounded-tool border-[1.5px] border-line-strong bg-paper px-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#173A5E]" />
      <span className="text-[13.5px] font-bold">{t('agree')}</span>
    </label>
  )
}

export function ConsentPanel() {
  const t = useTranslations('app.consent')
  const { refresh } = useSession()
  const me = useReadyMe()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/me/consents', { method: 'POST', json: { acceptTerms: true } })
      await refresh()
    } catch {
      setError(t('error'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Screen>
      <div className="flex flex-col gap-4 pt-8">
        <Heading>{t('updatedTitle')}</Heading>
        <Lead>{t('updatedLead')}</Lead>
        <ConsentSummary />
        {me && needsGuardianConsent(me.person.age) && <GuardianConsentNote />}
        <ConsentCheckbox checked={agreed} onChange={setAgreed} />
        <ErrorNote>{error}</ErrorNote>
        <Button variant="night" disabled={!agreed || busy} onClick={() => void submit()}>{t('continue')}</Button>
      </div>
    </Screen>
  )
}
