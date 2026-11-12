'use client'

// 2つ目の確認(認証アプリのコード)。運営は必ず、団体のメンバーは機微な相談の中身を見るときに要る(盤 65)。
// 登録は1回だけ始める。途中で止まった因子は消してから作り直す
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { Button, Card, ErrorNote, Heading, Lead, Spinner, TextField } from './ui'

type Enrollment = { factorId: string; qr: string; secret: string }
type Prepared =
  | { kind: 'verified'; factorId: string }
  | { kind: 'enrolled'; enrollment: Enrollment }
  | { kind: 'failed'; reason: 'loadFailed' | 'enrollFailed' }

// 登録済みの因子があればそれを使い、なければ作る。途中で止まった因子は消してから作り直す(同じ名前の因子が残ると登録できない)
async function prepareFactor(purpose: 'admin' | 'member'): Promise<Prepared> {
  const { data, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) return { kind: 'failed', reason: 'loadFailed' }
  const verified = data.totp.find((f) => f.status === 'verified')
  if (verified) return { kind: 'verified', factorId: verified.id }
  for (const f of data.all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `samasama-${purpose}-${Date.now()}` })
  if (enrollError || !enrolled) return { kind: 'failed', reason: 'enrollFailed' }
  return { kind: 'enrolled', enrollment: { factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret } }
}

export function MfaGate({ onVerified, purpose }: { onVerified: () => Promise<void>; purpose: 'admin' | 'member' }) {
  const t = useTranslations('app.mfa')
  const [loading, setLoading] = useState(true)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 登録は1回だけ始める(副作用が2回動いても、因子を2つ作って片方が失敗しないように)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void prepareFactor(purpose)
      .catch((): Prepared => ({ kind: 'failed', reason: 'loadFailed' }))
      .then((prepared) => {
        if (prepared.kind === 'failed') {
          setError(t(prepared.reason))
        } else if (prepared.kind === 'verified') {
          setFactorId(prepared.factorId)
        } else {
          setEnrollment(prepared.enrollment)
          setFactorId(prepared.enrollment.factorId)
        }
        setLoading(false)
      })
  }, [purpose, t])

  const verify = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError(t('codeInvalid'))
      return
    }
    setBusy(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (verifyError) {
      setError(t('codeWrong'))
      return
    }
    await onVerified()
  }

  if (loading) return <Spinner />
  return (
    <Card tone="support" className="flex flex-col gap-4 p-5">
      <Heading level={2}>{t('title')}</Heading>
      {enrollment ? (
        <>
          <Lead>{purpose === 'admin' ? t('enrollLeadAdmin') : t('enrollLeadMember')}</Lead>
          {/* QR は Supabase Auth が返す SVG の data URL */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt={t('qrAlt')} className="h-48 w-48 self-center rounded-tool border border-line bg-white p-2" />
          <p className="m-0 break-all text-t12 text-mist">{t('secret')}: <span className="font-mono">{enrollment.secret}</span></p>
        </>
      ) : (
        <Lead>{t('verifyLead')}</Lead>
      )}
      <TextField label={t('code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} className="max-w-[200px]" />
      <ErrorNote>{error}</ErrorNote>
      <Button tone="support" variant="night" disabled={busy} onClick={() => void verify()}>{t('verify')}</Button>
    </Card>
  )
}
