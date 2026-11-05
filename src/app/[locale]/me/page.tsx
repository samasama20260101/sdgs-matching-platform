'use client'

// わたし(盤 17): 呼び名・地域・言語・年齢 / 知らせの受け取り方 / ログインの方法 / 支える側にもなる / 退会
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { isAppLocale, localeLabels } from '@/i18n/routing'
import { apiFetch, ApiError } from '@/lib/client/api'
import { countryName } from '@/lib/constants/countries'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { useSession } from '@/components/app/SessionProvider'
import { Button, Card, ErrorNote, Heading, SectionLabel, Tip, Toggle } from '@/components/app/ui'
import { draftToPayload, profileDraftErrors, ProfileFields, type ProfileDraft } from '@/components/app/ProfileFields'
import type { MePerson } from '@/lib/client/meTypes'
import { Invitations } from '@/components/support/Invitations'
import { MfaGate } from '@/components/app/MfaGate'

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true'

function ProfileCard({ person, onSaved }: { person: MePerson; onSaved: () => Promise<void> }) {
  const t = useTranslations('app.me')
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    setDraft({
      displayName: person.displayName,
      age: person.age === null ? '' : String(person.age),
      country: person.country,
      regionCode: person.regionCode ?? '',
      city: person.city ?? '',
      locale: isAppLocale(person.locale) ? person.locale : 'ja',
    })
    setEditing(true)
  }

  const save = async () => {
    if (!draft) return
    const errs = profileDraftErrors(draft)
    if (errs.displayName || errs.age || errs.country) {
      setError(t('checkInput'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = draftToPayload(draft)
      // 年齢は変えたときだけ送る(送るとその日が新しい基準日になる)
      const body = person.age === payload.age ? { ...payload, age: undefined } : payload
      await apiFetch('/api/me', { method: 'PATCH', json: body })
      await onSaved()
      setEditing(false)
      if (draft.locale !== person.locale) router.replace('/me', { locale: draft.locale })
    } catch {
      setError(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (editing && draft) {
    return (
      <Card className="flex flex-col gap-4 p-4">
        <ProfileFields draft={draft} onChange={setDraft} showErrors={Boolean(error)} />
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button variant="night" disabled={busy} onClick={() => void save()} className="flex-1">{t('save')}</Button>
          <Button variant="outline" onClick={() => setEditing(false)}>{t('cancel')}</Button>
        </div>
      </Card>
    )
  }

  const place = [countryName(person.country, person.locale), person.city].filter(Boolean).join(' ')
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lamp-soft text-[18px] font-bold" aria-hidden>
        {person.displayName.slice(0, 1)}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[16px] font-bold">{person.displayName}</span>
        <span className="text-[12.5px] text-mist">
          {place} ・ {isAppLocale(person.locale) ? localeLabels[person.locale] : person.locale} ・ {person.age === null ? t('ageUnknown') : t('ageYears', { age: person.age })}
        </span>
      </span>
      <Button variant="outline" onClick={start} className="min-h-[40px] px-3 text-[13px]">{t('edit')}</Button>
    </Card>
  )
}

function NotificationsCard() {
  const t = useTranslations('app.me')
  const [prefs, setPrefs] = useState<{ email: boolean; push: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    apiFetch<{ email: boolean; push: boolean }>('/api/me/notifications').then(setPrefs).catch(() => setError(t('loadFailed')))
  }, [t])
  const update = async (patch: Partial<{ email: boolean; push: boolean }>) => {
    if (!prefs) return
    const before = prefs
    setPrefs({ ...prefs, ...patch })
    try {
      await apiFetch('/api/me/notifications', { method: 'PATCH', json: patch })
    } catch {
      setPrefs(before)
      setError(t('saveFailed'))
    }
  }
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold">{t('notifications')}</span>
        <Tip kind="warn" label={t('notificationsTipLabel')}>{t('notificationsTip')}</Tip>
      </div>
      <div className="flex min-h-[48px] items-center justify-between">
        <span className="text-[14px] font-bold">{t('inApp')}</span>
        <span className="text-[12px] text-mist">{t('alwaysOn')}</span>
      </div>
      <Toggle checked={prefs?.email ?? false} disabled={!prefs} onChange={(v) => void update({ email: v })} label={t('email')} description={t('emailNote')} />
      {/* スマホへの通知は、使えるようになったら出す(準備中の行は出さない) */}
      <ErrorNote>{error}</ErrorNote>
    </Card>
  )
}

function WithdrawCard() {
  const t = useTranslations('app.me')
  const { signOut } = useSession()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const withdraw = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/me/withdraw', { method: 'POST', json: { confirm: true } })
      await signOut()
      router.replace('/')
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'LAST_OWNER' ? t('withdrawLastOwner') : t('withdrawFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold">{t('withdraw')}</span>
        <Tip kind="warn" label={t('withdrawTipLabel')}>{t('withdrawTip')}</Tip>
      </div>
      {confirming ? (
        <>
          <p className="m-0 text-[13px] leading-[1.7] text-ink-soft">{t('withdrawConfirm')}</p>
          <div className="flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => void withdraw()} className="flex-1">{t('withdrawYes')}</Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>{t('cancel')}</Button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="self-start min-h-[44px] text-[13px] font-bold text-coral-ink underline">{t('withdraw')}</button>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Card>
  )
}

export default function MePage() {
  const t = useTranslations('app.me')
  const tMfa = useTranslations('app.mfa')
  const [mfaOpen, setMfaOpen] = useState(false)
  const { refresh, signOut, canSupport } = useSession()
  const router = useRouter()
  return (
    <RequireMe>
      {(me) => (
        <AppFrame>
          <Heading level={2}>{t('title')}</Heading>
          <Invitations />
          <ProfileCard person={me.person} onSaved={refresh} />
          <NotificationsCard />

          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">{t('loginMethods')}</span>
              <Tip label={t('loginMethodsTipLabel')}>{t('loginMethodsTip')}</Tip>
            </div>
            <div className="flex min-h-[44px] items-center justify-between text-[14px]">
              <span>{t('emailCode')}</span>
              <span className="text-[12.5px] text-mist">{me.email ?? '—'}</span>
            </div>
            {(GOOGLE_ENABLED || me.loginMethods.includes('google')) && (
              <div className="flex min-h-[44px] items-center justify-between text-[14px]">
                <span>Google</span>
                <span className="text-[12.5px] text-mist">{me.loginMethods.includes('google') ? t('linked') : t('notLinked')}</span>
              </div>
            )}
          </Card>

          {me.faces.organizations.length > 0 && (
            me.mfa.verified
              ? <Card className="p-4"><span className="text-[14px] font-bold text-leaf">{tMfa('done')}</span></Card>
              : me.mfa.enrolled || mfaOpen
                ? <MfaGate purpose="member" onVerified={refresh} />
                : (
                  <Card className="flex flex-col gap-2 p-4">
                    <span className="text-[15px] font-bold">{tMfa('card')}</span>
                    <span className="text-[12.5px] text-mist">{tMfa('cardNote')}</span>
                    {/* 押したときだけ登録を始める(開いただけで因子を作らない) */}
                    <Button variant="outline" onClick={() => setMfaOpen(true)}>{tMfa('title')}</Button>
                  </Card>
                )
          )}

          <Card className="p-4">
            {canSupport ? (
              <Link href="/support" className="flex min-h-[48px] items-center justify-between text-[15px] font-bold text-night no-underline">
                {t('toSupport')}<span aria-hidden>›</span>
              </Link>
            ) : (
              <Link href="/support/join" className="flex min-h-[48px] flex-col justify-center text-night no-underline">
                <span className="text-[15px] font-bold">{t('becomeSupporter')}</span>
                <span className="text-[12px] text-mist">{t('becomeSupporterNote')}</span>
              </Link>
            )}
          </Card>

          <SectionLabel>{t('account')}</SectionLabel>
          <Button variant="outline" onClick={() => { void signOut().then(() => router.replace('/')) }}>{t('signOut')}</Button>
          <WithdrawCard />
        </AppFrame>
      )}
    </RequireMe>
  )
}
