'use client'

// 相談を書く(盤 12・12b・16)。自分の言葉で書いて、そのまま届ける。
// 困りごとの候補を選ぶ段はない(#133、2026-11-17 運営了承)。分類はサービスの側で、届けるときに AI が裏で行う(src/app/api/cases/route.ts)。
// 会社・地域として相談するときは、届ける前に「どの会社・地域として届けるか」を選ぶ(なければその場で登録)段を足す。
// 会社・地域の登録もログインも先に求めない(何が得られるか分からないうちに登録する人はいない。2026-11-17 岡本さん)。
// ログインしていない人は、届けるところでログインへ進む。書いた内容は端末(sessionStorage)に預け、戻ってきたら続きから出す
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { apiFetch, ApiError } from '@/lib/client/api'
import { detectUrgency } from '@/lib/urgency'
import { DESCRIPTION_MAX, EXTRA_MAX, type SubjectType } from '@/lib/domain/intake'
import { HeavyWordsNotice } from './HeavyWordsNotice'
import { Button, ErrorNote, Heading, StepBar, TextArea, TextField, Tip } from '@/components/app/ui'
import { DRAFT_STORAGE_KEY, parseDraft, serializeDraft, type ConsultDraft } from '@/lib/domain/consultDraft'
import { loginPathFor } from '@/lib/domain/safeNext'

// 下書きの読み書き。書けない端末(設定・容量)では預けられないだけで、ログインのあとに書き直してもらう
function readDraft(subject: SubjectType): ConsultDraft | null {
  try {
    return parseDraft(window.sessionStorage.getItem(DRAFT_STORAGE_KEY), subject, Date.now())
  } catch {
    return null
  }
}
function writeDraft(draft: ConsultDraft) {
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, serializeDraft(draft, Date.now()))
  } catch {
    // 預けられなくても、ログインには進める
  }
}
function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // なにもしない
  }
}

// 届ける会社・地域を選ぶ段(会社・地域の相談だけ)。send に会社・地域を渡すと相談を届け、届けられたら true を返す
export type OrganizationStep = (args: { send: (organizationId: string) => Promise<boolean>; busy: boolean }) => ReactNode

// signedIn: ログインして、はじめの質問と同意まで済んでいるか。済んでいなければ届けるところでログインへ進む。
// この部品はセッションが分かってから(ブラウザで)描く前提で、最初の描画で端末の下書きを読む(OptionalMe が守る)
export function WriteFlow({
  subject,
  organizationStep,
  entryCode,
  signedIn,
}: {
  subject: SubjectType
  organizationStep?: OrganizationStep
  entryCode?: string | null
  signedIn: boolean
}) {
  const t = useTranslations('consult.write')
  const router = useRouter()
  const pathname = usePathname()
  // ログインから戻ってきたときの下書き。ログイン済みで会社・地域の相談なら、届ける会社・地域を選ぶ段から続ける
  const [draft] = useState(() => readDraft(subject))
  const [step, setStep] = useState<1 | 2>(draft && signedIn && organizationStep ? 2 : 1)
  const [words, setWords] = useState(draft?.words ?? '')
  const [since, setSince] = useState(draft?.since ?? '')
  const [wish, setWish] = useState(draft?.wish ?? '')
  const resumed = draft !== null && signedIn
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urgentWords = detectUrgency([words, since, wish].join('\n'))
  const ready = words.trim().length > 0

  const submit = async (organizationId?: string): Promise<boolean> => {
    if (!ready) return false
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch<{ id: string }>('/api/cases', {
        method: 'POST',
        json: {
          subjectType: subject,
          subjectOrganizationId: organizationId,
          description: words,
          since: since.trim() || undefined,
          wish: wish.trim() || undefined,
          entryCode: entryCode ?? undefined,
        },
      })
      clearDraft()
      router.replace(`/cases/${res.id}?sent=1`)
      return true
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      setError(code === 'ACTIVE_LIMIT' ? t('activeLimit') : code === 'DAILY_LIMIT' ? t('dailyLimit') : t('sendFailed'))
      setBusy(false)
      return false
    }
  }

  // 届けるところでログインへ進む。書いた内容を預け、ログインのあとはこの画面(クエリも含む)に戻る
  const goLogin = () => {
    writeDraft({ subject, words, since, wish })
    router.push(loginPathFor(pathname, window.location.search))
  }

  const wordsTitle = subject === 'COMPANY' ? t('wordsTitleCompany') : subject === 'COMMUNITY' ? t('wordsTitleCommunity') : t('wordsTitle')
  const orgStepLabel = subject === 'COMPANY' ? t('step2Company') : t('step2Community')

  return (
    <div className="flex flex-col gap-4">
      {organizationStep && <StepBar label={step === 1 ? t('step1Org') : orgStepLabel} step={step} total={2} />}
      {resumed && <p role="status" className="m-0 rounded-tool bg-lamp-faint px-3 py-2 text-t13 font-bold text-ink-soft">{t('resumedNote')}</p>}

      {step === 2 && organizationStep ? (
        <>
          {organizationStep({ send: submit, busy })}
          {busy && <p role="status" className="m-0 text-t12_5 text-mist">{t('sendingNote')}</p>}
          <ErrorNote>{error}</ErrorNote>
          <button type="button" onClick={() => setStep(1)} className="self-start min-h-[44px] text-t13 text-night underline">{t('backToWords')}</button>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <Heading level={2}>{wordsTitle}</Heading>
            <Tip label={t('wordsTipLabel')}>{t('wordsTip')}</Tip>
          </div>
          <p className="m-0 rounded-tool bg-lamp-faint px-3 py-2 text-t12_5 font-bold text-ink-soft">{t('noPersonalInfo')}</p>
          <TextArea label={t('words')} value={words} maxLength={DESCRIPTION_MAX} onChange={(e) => setWords(e.target.value)} />
          <span className="-mt-3 self-end text-t12 text-mist">{t('charCount', { count: words.length })}</span>
          {urgentWords && <HeavyWordsNotice />}
          <TextField label={t('since')} hint={t('optional')} value={since} maxLength={EXTRA_MAX} onChange={(e) => setSince(e.target.value)} />
          <TextField label={t('wish')} hint={t('optional')} value={wish} maxLength={EXTRA_MAX} onChange={(e) => setWish(e.target.value)} />
          {!signedIn && <p className="m-0 text-t12_5 leading-[1.7] text-mist">{t('loginToSendNote')}</p>}
          <ErrorNote>{error}</ErrorNote>
          {organizationStep ? (
            <Button variant="night" disabled={!ready} onClick={() => { setError(null); if (signedIn) setStep(2); else goLogin() }}>
              {!ready ? t('sendNeedsWords') : signedIn ? (subject === 'COMPANY' ? t('nextToCompany') : t('nextToCommunity')) : (subject === 'COMPANY' ? t('loginToChooseCompany') : t('loginToChooseCommunity'))}
            </Button>
          ) : (
            <Button variant="night" disabled={!ready || busy} onClick={() => { if (signedIn) void submit(); else goLogin() }}>
              {!ready ? t('sendNeedsWords') : busy ? t('sending') : signedIn ? t('send') : t('loginToSend')}
            </Button>
          )}
          {busy && <p role="status" className="m-0 text-t12_5 text-mist">{t('sendingNote')}</p>}
        </>
      )}
    </div>
  )
}
