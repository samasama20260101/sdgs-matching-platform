'use client'

// ログインに使うメールアドレスを本人が変える(#155)。「わたし」のログインの方法の欄に置く。
// 新しいアドレスに届く 6 けたのコードで確定し、古いアドレスでは確かめない(Auth の double_confirm_changes = false)。
// 変わったことは Auth が古いアドレスに知らせる(ops/supabase-auth の email-changed-notification.html)。
// 知らせのメールは送るたびに Auth からアドレスを読むので、ここで変えれば知らせの宛先も変わる(users にメールは持たない)
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { emailChangeError, normalizeEmail } from '@/lib/domain/accountEmail'
import { Button, ErrorNote, TextField } from '@/components/app/ui'

const RESEND_SECONDS = 60

export function EmailChange({ current, open, onOpenChange, onChanged }: {
  current: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => Promise<void>
}) {
  const t = useTranslations('app.me')
  const ts = useTranslations('app.start')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const reset = () => {
    setEmail('')
    setSentTo(null)
    setCode('')
    setError(null)
  }

  const errorText = (kind: ReturnType<typeof emailChangeError>) =>
    kind === 'TAKEN' ? t('emailTaken')
      : kind === 'TOO_MANY' ? ts('tooMany')
        : kind === 'NEEDS_MFA' ? t('emailNeedsMfa')
          : kind === 'INVALID' ? ts('emailInvalid')
            : ts('sendFailed')

  const send = async (address: string | null) => {
    if (!address) {
      setError(ts('emailInvalid'))
      return
    }
    if (current && address === current.toLowerCase()) {
      setError(t('emailSame'))
      return
    }
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.auth.updateUser({ email: address })
    setBusy(false)
    if (e) {
      setError(errorText(emailChangeError(e)))
      return
    }
    setSentTo(address)
    setCode('')
    setCooldown(RESEND_SECONDS)
  }

  const verify = async () => {
    if (!sentTo) return
    const token = code.replace(/\s/g, '')
    if (!/^\d{6,8}$/.test(token)) {
      setError(ts('codeInvalid'))
      return
    }
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.auth.verifyOtp({ email: sentTo, token, type: 'email_change' })
    if (e) {
      setBusy(false)
      setError(ts('codeWrong'))
      return
    }
    // 画面のアドレスは /api/me が Auth から読み直す
    await onChanged()
    setBusy(false)
    reset()
    setDone(true)
    onOpenChange(false)
  }

  if (!open) {
    return (
      <>
        {done && <p className="m-0 text-t12_5 font-bold text-leaf" role="status">{t('emailChanged')}</p>}
        <Button variant="outline" onClick={() => { setDone(false); reset(); onOpenChange(true) }} className="min-h-[40px] self-start px-3 text-t13">{t('changeEmail')}</Button>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-tool bg-steel-faint p-3">
      {!sentTo ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void send(normalizeEmail(email)) }}>
          <TextField label={t('newEmail')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="m-0 text-t12_5 leading-[1.7] text-mist">{t('changeEmailNote')}</p>
          <div className="flex gap-2">
            <Button type="submit" variant="night" disabled={busy} className="flex-1">{ts('sendCode')}</Button>
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>{t('cancel')}</Button>
          </div>
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void verify() }}>
          <p className="m-0 text-t13_5 leading-[1.7] text-ink-soft">{ts('sentTo', { email: sentTo })}</p>
          <TextField
            label={ts('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            className="max-w-[220px]"
          />
          <Button type="submit" variant="night" disabled={busy}>{t('confirmEmailChange')}</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" disabled={cooldown > 0 || busy} onClick={() => void send(sentTo)}>
              {cooldown > 0 ? ts('resendIn', { seconds: cooldown }) : ts('resend')}
            </Button>
            <Button variant="quiet" onClick={() => { reset(); onOpenChange(false) }}>{t('cancel')}</Button>
          </div>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  )
}
