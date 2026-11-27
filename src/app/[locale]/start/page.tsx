'use client'

// はじめる(盤 11): 1 ／ 2 ログイン(Google かメールに届くコード。パスワードは作らない。メールが使えなくなった人は確認済みの電話番号の SMS、#155)
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
import { normalizePhone } from '@/lib/domain/accountEmail'

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true'
const RESEND_SECONDS = 60



function LoginStep({ next, onLostEmail }: { next: string; onLostEmail?: () => void }) {
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

  // Google とメールのリンクは別のページ(/auth/callback)に戻るので、戻り先をクエリで持たせる
  // (持たせないと、会社として相談する → ログイン のあと、相談の画面でなくホームに着く)
  const callbackUrl = () => `${window.location.origin}${withLocalePath(locale, '/auth/callback')}?next=${encodeURIComponent(next)}`

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
    // ログアウトしてもブラウザの Google のログインは残るので、毎回アカウントを選ぶ画面を出す
    // (出さないと前の Google アカウントで自動的に入り、別のアカウントに替えられない)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(), queryParams: { prompt: 'select_account' } },
    })
    if (oauthError) setError(t('sendFailed'))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        {/* コードを送ったあとは Google の入口を隠すので、「どちらで続けますか」でなくコードを入れる段の見出しにする */}
        <Heading>{t(sentTo ? 'codeTitle' : GOOGLE_ENABLED ? 'loginTitle' : 'loginTitleEmailOnly')}</Heading>
        <Tip label={t('loginTipLabel')}>{t('loginTip')}</Tip>
      </div>
      {GOOGLE_ENABLED && !sentTo && (
        <>
          <Button variant="outline" onClick={() => void google()}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-steel text-t12 font-bold" aria-hidden>G</span>
            {t('google')}
          </Button>
          <div className="flex items-center gap-3 text-t12 text-mist" aria-hidden>
            <span className="h-px flex-1 bg-line" />{t('or')}<span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      {!sentTo ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void sendCode() }}>
          <TextField label={t('email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="night" disabled={busy}>{t('sendCode')}</Button>
          {onLostEmail && <Button variant="quiet" className="self-start" onClick={onLostEmail}>{t('lostEmail')}</Button>}
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void verify() }}>
          <p className="m-0 text-t13_5 leading-[1.7] text-ink-soft">{t('sentTo', { email: sentTo })}</p>
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
          {/* ログインのメールはコードだけでリンクを載せない(ops/supabase-auth の login-code.html)ので、リンクの案内は出さない */}
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

// メールアドレスが使えなくなった人の入口(#155)。電話番号を確認済みの人(個人の支え手)は、その番号に届く SMS のコードで入れる。
// 電話番号での新規登録は受け付けない(shouldCreateUser: false)。入ったあとは「わたし」の変える欄を開いて着く(StartInner)
function PhoneLogin({ onBack, onBeforeVerify }: { onBack: () => void; onBeforeVerify: () => void }) {
  const t = useTranslations('app.start')
  const [phone, setPhone] = useState('')
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

  const send = async (number: string | null) => {
    if (!number) {
      setError(t('phoneInvalid'))
      return
    }
    setBusy(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: number, options: { shouldCreateUser: false } })
    setBusy(false)
    if (otpError) {
      // 登録のない番号と送れなかったときを分けない(どの番号が登録済みかを外から確かめられないように)
      setError(otpError.status === 429 ? t('tooMany') : t('phoneSendFailed'))
      return
    }
    setSentTo(number)
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
    onBeforeVerify()
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone: sentTo, token, type: 'sms' })
    setBusy(false)
    if (verifyError) setError(t('codeWrong'))
  }

  return (
    <div className="flex flex-col gap-4">
      <Heading>{t('phoneTitle')}</Heading>
      <p className="m-0 text-t13_5 leading-[1.7] text-ink-soft">{t('phoneLead')}</p>
      {!sentTo ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void send(normalizePhone(phone)) }}>
          <TextField label={t('phone')} hint={t('phoneHint')} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button type="submit" variant="night" disabled={busy}>{t('sendSms')}</Button>
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void verify() }}>
          <p className="m-0 text-t13_5 leading-[1.7] text-ink-soft">{t('smsSentTo', { phone: sentTo })}</p>
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
          <Button variant="quiet" disabled={cooldown > 0 || busy} onClick={() => void send(sentTo)}>
            {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
          </Button>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
      <Button variant="quiet" onClick={onBack}>{t('backToEmail')}</Button>
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
  const [phoneMode, setPhoneMode] = useState(false)
  // 電話番号で入り直した人の着く先。メールアドレスを変えるために入ったので、「わたし」の変える欄を開いて着く
  const [afterLogin, setAfterLogin] = useState<string | null>(null)

  useEffect(() => {
    if (state.status === 'ready') router.replace(state.me.person.role === 'ADMIN' ? '/admin' : afterLogin ?? next)
  }, [state, router, next, afterLogin])

  return (
    <Screen>
      <AppHeader />
      <div className="flex flex-col gap-4 pb-8">
        <StepBar label={state.status === 'needsOnboarding' ? t('step2') : t('step1')} step={state.status === 'needsOnboarding' ? 2 : 1} total={2} />
        {state.status === 'loading' || state.status === 'ready' ? (
          <Spinner />
        ) : state.status === 'needsOnboarding' ? (
          <ProfileStep onDone={() => router.replace(afterLogin ?? next)} />
        ) : phoneMode ? (
          <PhoneLogin onBack={() => { setPhoneMode(false); setAfterLogin(null) }} onBeforeVerify={() => setAfterLogin('/me?email=change')} />
        ) : (
          <LoginStep next={next} onLostEmail={() => setPhoneMode(true)} />
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

