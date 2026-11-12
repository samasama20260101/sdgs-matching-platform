'use client'

// 支え手になる(盤 21)。同じアカウントのまま支える側になる。あなたの相談は、支える側からは見えない。
// 個人: 本名・得意なこと・遠隔で可・言語、電話番号の確認(申し出るのに必要)
// 団体: 申し込み → 運営が面談 → 承認されると一覧に載る(11/5 の審査の流れ。2段階に分けない)
//   申し込みでは、面談で確かめる6つの点を自己採点してもらう(11/12。面談前の自己採点はこれ1回)
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/client/api'
import { Link, useRouter } from '@/i18n/navigation'
import { localeLabels, locales, type AppLocale } from '@/i18n/routing'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { useSession } from '@/components/app/SessionProvider'
import { Button, Card, cx, ErrorNote, Heading, Lead, TextArea, TextField, Tip, Toggle } from '@/components/app/ui'
import type { MePerson } from '@/lib/client/meTypes'
import { AREA_GOALS, areaKey, areaSubjectsForFace } from '@/lib/domain/supportAreas'
import { canSupportAtAge } from '@/lib/domain/age'
import { SELF_CHECKS, SUPPORTER_CHECKS, checkAnswers, missingChecks, type SelfCheck, type SupporterCheck } from '@/lib/domain/supporterChecks'

const SUPPORTER_POINTS = ['age', 'purpose', 'inApp', 'sensitive', 'realName', 'records', 'stop'] as const
const ORG_TYPES = ['NPO', 'NGO', 'COMPANY', 'MUNICIPALITY', 'COMMUNITY', 'SCHOOL', 'INTERMEDIARY', 'PRO_BONO_LAWYER', 'OTHER_PUBLIC', 'OTHER'] as const
const APPLICATION_ITEMS = ['areas', 'staff', 'safeguarding', 'website', 'howFound'] as const

function SupporterTerms({ agreed, onChange }: { agreed: boolean; onChange: (v: boolean) => void }) {
  const t = useTranslations('support.join')
  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <span className="text-[14.5px] font-bold">{t('termsTitle')}</span>
      <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-[1.7] text-ink-soft">
        {SUPPORTER_POINTS.map((k) => <li key={k}>{t(`terms.${k}`)}</li>)}
      </ol>
      <Link href="/terms" className="text-[12.5px] text-night">{t('termsLink')}</Link>
      <label className="flex min-h-[48px] items-center gap-3">
        <input type="checkbox" checked={agreed} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-night" />
        <span className="text-[13.5px] font-bold">{t('agree')}</span>
      </label>
    </Card>
  )
}

function PhoneVerify() {
  const t = useTranslations('support.join')
  const { refresh } = useSession()
  const [phone, setPhone] = useState('+81')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const send = async () => {
    setError(null)
    if (!/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s-]/g, ''))) {
      setError(t('phoneInvalid'))
      return
    }
    setState('busy')
    const { error: e } = await supabase.auth.updateUser({ phone: phone.replace(/[\s-]/g, '') })
    setState('idle')
    if (e) setError(t('smsUnavailable'))
    else setSent(true)
  }
  const verify = async () => {
    setState('busy')
    setError(null)
    const { error: e } = await supabase.auth.verifyOtp({ phone: phone.replace(/[\s-]/g, ''), token: code, type: 'phone_change' })
    if (e) {
      setState('idle')
      setError(t('codeWrong'))
      return
    }
    try {
      await apiFetch('/api/support/profile/phone', { method: 'POST' })
      await refresh()
      setState('done')
    } catch {
      setState('idle')
      setError(t('saveFailed'))
    }
  }
  if (state === 'done') return <Card tone="support" className="bg-leaf-soft p-4"><span className="font-bold text-leaf-ink">{t('phoneDone')}</span></Card>
  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14.5px] font-bold">{t('phoneTitle')}</span>
        <Tip kind="warn" label={t('phoneTipLabel')}>{t('phoneTip')}</Tip>
      </div>
      {!sent ? (
        <>
          <TextField label={t('phone')} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button tone="support" variant="outline" disabled={state === 'busy'} onClick={() => void send()}>{t('sendSms')}</Button>
        </>
      ) : (
        <>
          <TextField label={t('smsCode')} inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} className="max-w-[200px]" />
          <Button tone="support" variant="night" disabled={state === 'busy' || code.length < 6} onClick={() => void verify()}>{t('verifyPhone')}</Button>
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Card>
  )
}

function IndividualForm({ person, onDone }: { person: MePerson; onDone: () => void }) {
  const t = useTranslations('support.join')
  const tSdgs = useTranslations('sdgs')
  const locale = useLocale()
  const [realName, setRealName] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [remote, setRemote] = useState(false)
  const [languages, setLanguages] = useState<AppLocale[]>([locale === 'en' || locale === 'es' ? locale : 'ja'])
  const [intro, setIntro] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!realName.trim() || !agreed) {
      setError(!realName.trim() ? t('realNameRequired') : t('agreeRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/support/profile', {
        method: 'PUT',
        json: { realName, skillAreas: skills, country: person.country, regionCode: person.regionCode, remoteOk: remote, languages, intro: intro || undefined, acceptSupporterTerms: true },
      })
      onDone()
    } catch {
      setError(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <Card tone="support" className="flex flex-col gap-4 p-4">
        <TextField label={<span className="inline-flex items-center gap-2">{t('realName')} <Tip label={t('realNameTipLabel')}>{t('realNameTip')}</Tip></span>} value={realName} maxLength={100} autoComplete="name" onChange={(e) => setRealName(e.target.value)} />
        {/* 得意なことは相談した人の種類ごとに選ぶ(大項目の名前が種類で違う。個人の支え手は会社と地域の相談だけ) */}
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold">{t('skills')} <Tip label={t('skills')}>{t('skillsNote')}</Tip></span>
          {/* 種類ごとに折りたたむ(30 の札が縦に並ぶと長い。画面の見直し 所見 16)。選んだ数を見出しに出す */}
          {areaSubjectsForFace('INDIVIDUAL').map((subject) => (
            <details key={subject} className="group rounded-tool border border-line bg-paper px-3">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 text-[13.5px] font-bold">
                <span>{t(`skillsFor.${subject}`)}</span>
                <span className="flex items-center gap-2 text-[12px] font-normal text-mist">
                  {t('skillsPicked', { count: skills.filter((k) => k.startsWith(`${subject}:`)).length })}
                  <span aria-hidden className="group-open:rotate-180">⌄</span>
                </span>
              </summary>
              <div className="flex flex-wrap gap-1.5 pb-3">
                {AREA_GOALS[subject].map((g) => {
                  const key = areaKey(subject, g)
                  const on = skills.includes(key)
                  return (
                    <button key={key} type="button" aria-pressed={on} onClick={() => setSkills(on ? skills.filter((x) => x !== key) : [...skills, key])} className={cx('min-h-[36px] rounded-full px-3 text-[12.5px] font-bold', on ? 'bg-night text-white' : 'border border-line bg-paper text-ink-soft')}>
                      {tSdgs(`area.${subject}.${g}`)}
                    </button>
                  )
                })}
              </div>
            </details>
          ))}
        </div>
        <Toggle checked={remote} onChange={setRemote} label={t('remote')} description={t('remoteNote')} />
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold">{t('languages')}</span>
          <div className="flex flex-wrap gap-3">
            {locales.map((l) => (
              <label key={l} className="flex min-h-[40px] items-center gap-2 text-[14px]">
                <input type="checkbox" checked={languages.includes(l)} onChange={(e) => setLanguages(e.target.checked ? [...languages, l] : languages.filter((x) => x !== l))} className="h-5 w-5 accent-night" />
                {localeLabels[l]}
              </label>
            ))}
          </div>
        </div>
        <TextArea label={t('intro')} value={intro} maxLength={500} onChange={(e) => setIntro(e.target.value)} />
        <Lead>{t('individualLimit')}</Lead>
      </Card>
      <SupporterTerms agreed={agreed} onChange={setAgreed} />
      <ErrorNote>{error}</ErrorNote>
      <Button tone="support" variant="night" disabled={busy || languages.length === 0} onClick={() => void submit()}>{t('registerIndividual')}</Button>
    </div>
  )
}

function SelfChecks({ choices, notes, onChoice, onNote }: {
  choices: Partial<Record<SupporterCheck, SelfCheck>>
  notes: Partial<Record<SupporterCheck, string>>
  onChoice: (check: SupporterCheck, value: SelfCheck) => void
  onNote: (check: SupporterCheck, value: string) => void
}) {
  const t = useTranslations('support.join')
  return (
    <Card tone="support" className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14.5px] font-bold">{t('checksTitle')}</span>
        <Tip label={t('checksTipLabel')}>{t('checksTip')}</Tip>
      </div>
      <ol className="m-0 flex list-none flex-col gap-5 p-0">
        {SUPPORTER_CHECKS.map((check, i) => (
          <li key={check} className="flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-night text-[12px] font-bold text-lamp" aria-hidden>{i + 1}</span>
              <span className="flex-1 text-[14px] font-bold leading-[1.7]">{t(`checks.${check}.statement`)}</span>
              <Tip label={t('checksNoteLabel')}>{t(`checks.${check}.note`)}</Tip>
            </div>
            <div role="radiogroup" aria-label={t(`checks.${check}.statement`)} className="grid grid-cols-2 gap-2">
              {SELF_CHECKS.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={choices[check] === v} onClick={() => onChoice(check, v)} className={cx('min-h-[44px] rounded-tool px-2 text-[13.5px] font-bold', choices[check] === v ? 'border-2 border-night bg-lamp-soft text-ink' : 'border-[1.5px] border-line-strong bg-paper text-ink-soft')}>
                  {t(`selfCheck.${v}`)}
                </button>
              ))}
            </div>
            <TextArea compact label={t(`checks.${check}.prompt`)} value={notes[check] ?? ''} maxLength={2000} rows={2} onChange={(e) => onNote(check, e.target.value)} />
          </li>
        ))}
      </ol>
    </Card>
  )
}

function OrganizationForm({ person }: { person: MePerson }) {
  const t = useTranslations('support.join')
  const tType = useTranslations('support.orgType')
  const [name, setName] = useState('')
  const [orgType, setOrgType] = useState<(typeof ORG_TYPES)[number]>('NPO')
  const [contactEmail, setContactEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [choices, setChoices] = useState<Partial<Record<SupporterCheck, SelfCheck>>>({})
  const [notes, setNotes] = useState<Partial<Record<SupporterCheck, string>>>({})
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refresh } = useSession()
  const submit = async () => {
    const checks = checkAnswers(choices, notes)
    const missing = missingChecks(checks)
    if (!name.trim() || missing.length > 0 || !agreed) {
      setError(!name.trim() ? t('orgNameRequired') : missing.length > 0 ? t('checksRequired', { numbers: missing.map((c) => SUPPORTER_CHECKS.indexOf(c) + 1).join('・') }) : t('agreeRequired'))
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
          purpose: 'SUPPORT',
          country: person.country,
          regionCode: person.regionCode,
          contactEmail: contactEmail.trim() || null,
          application: { ...Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim())), ...checks },
          acceptSupporterTerms: true,
        },
      })
      await refresh()
      setDone(true)
    } catch {
      setError(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }
  if (done) {
    return (
      <Card tone="support" className="flex flex-col gap-2 p-5">
        <span className="text-[16px] font-bold">{t('appliedTitle')}</span>
        <Lead>{t('appliedBody')}</Lead>
        <Link href="/support" className="text-[14px] font-bold text-night">{t('toSupportHome')}</Link>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <span className="text-[14.5px] font-bold">{t('flowTitle')}</span>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-[1.7] text-ink-soft">
          <li>{t('flow.apply')}</li><li>{t('flow.interview')}</li><li>{t('flow.approved')}</li>
        </ol>
      </Card>
      <Card tone="support" className="flex flex-col gap-4 p-4">
        <TextField label={t('orgName')} hint={t('orgNameHint')} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">{t('orgType')}</span>
          <select value={orgType} onChange={(e) => setOrgType(ORG_TYPES.find((x) => x === e.target.value) ?? 'OTHER')} className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px]">
            {ORG_TYPES.map((o) => <option key={o} value={o}>{tType(o)}</option>)}
          </select>
        </label>
        <TextField label={<span className="inline-flex items-center gap-2">{t('contactEmail')} <Tip label={t('contactEmailTipLabel')}>{t('contactEmailTip')}</Tip></span>} type="email" value={contactEmail} maxLength={254} onChange={(e) => setContactEmail(e.target.value)} />
      </Card>
      <SelfChecks choices={choices} notes={notes} onChoice={(c, v) => setChoices({ ...choices, [c]: v })} onNote={(c, v) => setNotes({ ...notes, [c]: v })} />
      <Card tone="support" className="flex flex-col gap-4 p-4">
        {APPLICATION_ITEMS.map((k) => (
          <TextArea key={k} label={t(`application.${k}`)} value={answers[k] ?? ''} maxLength={2000} rows={3} onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })} />
        ))}
      </Card>
      <SupporterTerms agreed={agreed} onChange={setAgreed} />
      <ErrorNote>{error}</ErrorNote>
      <Button tone="support" variant="night" disabled={busy} onClick={() => void submit()}>{t('apply')}</Button>
    </div>
  )
}

function Join() {
  const t = useTranslations('support.join')
  const router = useRouter()
  const [tab, setTab] = useState<'individual' | 'organization'>('individual')
  const [registered, setRegistered] = useState(false)
  const { refresh } = useSession()
  return (
    <RequireMe>
      {(me) => (
        <AppFrame tone="support">
          <div className="flex items-start justify-between gap-3">
            <Heading level={2}>{t('title')}</Heading>
            <Tip label={t('tipLabel')}>{t('tip')}</Tip>
          </div>
          {!canSupportAtAge(me.person.age) ? (
            <Card tone="support" className="flex flex-col gap-2 p-4">
              <span className="text-[15px] font-bold">{t('underAgeTitle')}</span>
              <Lead>{t('underAgeBody')}</Lead>
              <Link href="/me" className="text-[13.5px] font-bold text-night">{t('underAgeFix')}</Link>
            </Card>
          ) : (
            <>
            <div role="tablist" className="grid grid-cols-2 rounded-tool bg-steel p-1">
              {(['individual', 'organization'] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('min-h-[44px] rounded-tool text-[14px] font-bold', tab === k ? 'bg-paper text-ink shadow-sm' : 'text-ink-soft')}>
                  {t(`tab.${k}`)}
                </button>
              ))}
            </div>
            {tab === 'individual' ? (
              me.faces.individual || registered ? (
                <div className="flex flex-col gap-3">
                  <Card tone="support" className="p-4"><Lead>{t('individualRegistered')}</Lead></Card>
                  {!me.faces.individual?.phoneVerified && <PhoneVerify />}
                  <Button tone="support" variant="night" onClick={() => router.push('/support')}>{t('toSupportHome')}</Button>
                </div>
              ) : (
                <IndividualForm person={me.person} onDone={() => { setRegistered(true); void refresh() }} />
              )
            ) : (
              <OrganizationForm person={me.person} />
            )}
            </>
          )}
        </AppFrame>
      )}
    </RequireMe>
  )
}

export default function JoinPage() {
  return <Join />
}
