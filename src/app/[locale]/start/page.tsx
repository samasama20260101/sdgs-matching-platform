'use client'

// はじめる(盤 11): 1 ／ 2 ログイン(Google かメールに届くコード。パスワードは作らない)
//                    2 ／ 2 呼び名・年齢・国と地域・言語(名前・電話・住所・性別・生年月日は聞かない)
import { Suspense, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/client/api'
import { useRouter } from '@/i18n/navigation'
import { isAppLocale, withLocalePath } from '@/i18n/routing'
import { useSession } from '@/components/app/SessionProvider'
import { AppHeader } from '@/components/app/AppShell'
import { Button, Card, ErrorNote, Heading, Screen, Spinner, StepBar, TextField, Tip } from '@/components/app/ui'
import { ConsentCheckbox, ConsentSummary } from '@/components/app/ConsentPanel'
import { draftToPayload, emptyProfileDraft, profileDraftErrors, ProfileFields, type ProfileDraft } from '@/components/app/ProfileFields'

import { safeNext } from '@/lib/domain/safeNext'

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true'
const RESEND_SECONDS = 60



function LoginStep() {
  const t = useTranslations('app.start')
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const callbackUrl = () => `${window.location.origin}${withLocalePath(locale, '/auth/callback')}`

  const sendCode = async () => {
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(t('emailInvalid'))
      return
    }
    setBusy(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl() },
    })
    setBusy(false)
    if (otpError) {
      setError(otpError.status === 429 ? t('tooMany') : t('sendFailed'))
      return
    }
    setSentTo(address)
    setCooldown(RESEND_SECONDS)
  }

  const verify = async () => {
    if (!sentTo) return
    const token = code.replace(/\s/g, '')
    if (!/^\d{6,8}$/.test(token)) {
      setError(t('codeInvalid'))
      return
    }
    setBusy(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: sentTo, token, type: 'email' })
    setBusy(false)
    if (verifyError) setError(t('codeWrong'))
    // 成功するとセッションが変わり、SessionProvider が次の段に進める
  }

  const google = async () => {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } })
    if (oauthError) setError(t('sendFailed'))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <Heading>{t(GOOGLE_ENABLED ? 'loginTitle' : 'loginTitleEmailOnly')}</Heading>
        <Tip label={t('loginTipLabel')}>{t('loginTip')}</Tip>
      </div>
      {GOOGLE_ENABLED && !sentTo && (
        <>
          <Button variant="outline" onClick={() => void google()}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-steel text-[12px] font-bold" aria-hidden>G</span>
            {t('google')}
          </Button>
          <div className="flex items-center gap-3 text-[12px] text-mist" aria-hidden>
            <span className="h-px flex-1 bg-line" />{t('or')}<span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      {!sentTo ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void sendCode() }}>
          <TextField label={t('email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="night" disabled={busy}>{t('sendCode')}</Button>
          <p className="m-0 text-[12.5px] leading-[1.7] text-mist">{t('sendCodeNote')}</p>
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void verify() }}>
          <p className="m-0 text-[13.5px] leading-[1.7] text-ink-soft">{t('sentTo', { email: sentTo })}</p>
          <TextField
            label={t('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            className="max-w-[220px]"
          />
          <Button type="submit" variant="night" disabled={busy}>{t('verify')}</Button>
          <p className="m-0 text-[12.5px] leading-[1.7] text-mist">{t('linkAlsoWorks')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" disabled={cooldown > 0 || busy} onClick={() => void sendCode()}>
              {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
            </Button>
            <Button variant="quiet" onClick={() => { setSentTo(null); setCode(''); setError(null) }}>{t('changeEmail')}</Button>
          </div>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  )
}

function ProfileStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('app.start')
  const locale = useLocale()
  const { refresh, signOut } = useSession()
  const [draft, setDraft] = useState<ProfileDraft>(() => emptyProfileDraft(isAppLocale(locale) ? locale : 'ja'))
  const [agreed, setAgreed] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const errs = profileDraftErrors(draft)
    if (errs.displayName || errs.age || errs.country || !agreed) {
      setShowErrors(true)
      if (!agreed) setError(t('agreeRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/me', { method: 'POST', json: { ...draftToPayload(draft), acceptTerms: true } })
      await refresh()
      onDone()
    } catch {
      setError(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <Heading>{t('profileTitle')}</Heading>
        <Tip label={t('profileTipLabel')}>{t('profileTip')}</Tip>
      </div>
      <Card className="p-4">
        <ProfileFields draft={draft} onChange={setDraft} showErrors={showErrors} />
      </Card>
      <ConsentSummary />
      <ConsentCheckbox checked={agreed} onChange={setAgreed} />
      <ErrorNote>{error}</ErrorNote>
      <Button variant="night" disabled={busy} onClick={() => void submit()}>{t('finish')}</Button>
      <Button variant="quiet" onClick={() => void signOut()}>{t('useAnotherAccount')}</Button>
    </div>
  )
}

function StartInner() {
  const { state } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const t = useTranslations('app.start')

  useEffect(() => {
    if (state.status === 'ready') router.replace(state.me.person.role === 'ADMIN' ? '/admin' : next)
  }, [state, router, next])

  return (
    <Screen>
      <AppHeader />
      <div className="flex flex-col gap-4 pb-8">
        <StepBar label={state.status === 'needsOnboarding' ? t('step2') : t('step1')} step={state.status === 'needsOnboarding' ? 2 : 1} total={2} />
        {state.status === 'loading' || state.status === 'ready' ? (
          <Spinner />
        ) : state.status === 'needsOnboarding' ? (
          <ProfileStep onDone={() => router.replace(next)} />
        ) : (
          <LoginStep />
        )}
      </div>
    </Screen>
  )
}

export default function StartPage() {
  return (
    <Suspense fallback={<Screen><Spinner /></Screen>}>
      <StartInner />
    </Suspense>
  )
}

