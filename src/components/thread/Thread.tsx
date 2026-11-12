'use client'

// やりとり(盤 15)。相談する側と支える側で同じ部品を使う。原文と訳を切り替えられる。
// 更新はリアルタイムの購読を使わず、画面を開いている間だけ 20 秒ごとに読み直す(operations.md §7: Realtime の直接購読はしない)。
// 読み直しは新しい分だけを取って足す(domain/thread.ts)。開いたときと訳を作ったあとは全部を取り直す
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { Button, cx, ErrorNote } from '@/components/app/ui'
import { mergeThread, threadPollAfter } from '@/lib/domain/thread'

type Message = {
  id: string
  kind: 'USER' | 'SYSTEM'
  content: string
  system: { key: string; params: Record<string, string> } | null
  mine: boolean
  side: 'CONSULTEE' | 'SUPPORTER'
  senderLabel: string
  originalLanguage: string | null
  translation: string | null
  createdAt: string
}

const POLL_MS = 20_000

// 相談した人が自分の画面で読むときは、「相談した人が…」でなく「あなたが…」と書く(画面の見直し 所見 6)
const SELF_SYSTEM_KEYS = new Set(['resolvedConfirmed', 'resolvedNotYet', 'cancelled'])
function systemKey(key: string, tone: 'consult' | 'support'): string {
  return tone === 'consult' && SELF_SYSTEM_KEYS.has(key) ? `systemSelf.${key}` : `system.${key}`
}

export function Thread({ caseId, tone = 'consult' }: { caseId: string; tone?: 'consult' | 'support' }) {
  const t = useTranslations('consult.thread')
  const locale = useLocale()
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  // 読み直しの起点。描画のたびに変わる messages を load の依存に入れないため ref で持つ
  const messagesRef = useRef<Message[] | null>(null)

  const load = useCallback(async (mode: 'all' | 'new' = 'all') => {
    const after = mode === 'new' && messagesRef.current ? threadPollAfter(messagesRef.current) : null
    try {
      const qs = new URLSearchParams({ lang: locale })
      if (after) qs.set('after', after)
      const d = await apiFetch<{ messages: Message[]; open: boolean }>(`/api/cases/${caseId}/messages?${qs}`)
      const next = after && messagesRef.current ? mergeThread(messagesRef.current, d.messages) : d.messages
      messagesRef.current = next
      setMessages(next)
      setOpen(d.open)
    } catch {
      setError(t('loadFailed'))
    }
  }, [caseId, locale, t])

  useEffect(() => {
    messagesRef.current = null
    void load('all')
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load('new') }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const send = async () => {
    const content = draft.trim()
    if (!content) return
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/api/cases/${caseId}/messages`, { method: 'POST', json: { content } })
      setDraft('')
      await load('new')
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch {
      setError(t('sendFailed'))
    } finally {
      setBusy(false)
    }
  }

  const translate = async () => {
    setTranslating(true)
    setError(null)
    try {
      await apiFetch(`/api/cases/${caseId}/messages/translate`, { method: 'POST', json: { lang: locale } })
      await load('all')
      setShowTranslation(true)
    } catch {
      setError(t('translateFailed'))
    } finally {
      setTranslating(false)
    }
  }

  if (messages === null) return null
  const foreign = messages.some((m) => m.kind === 'USER' && !m.mine && m.originalLanguage && m.originalLanguage !== locale)

  return (
    <section aria-label={t('label')} className="flex flex-col gap-2">
      {foreign && (
        <div className="flex justify-end">
          {messages.some((m) => m.translation) ? (
            <Button tone={tone} variant="quiet" onClick={() => setShowTranslation((v) => !v)} className="min-h-[36px] text-t13">
              {showTranslation ? t('showOriginal') : t('showTranslation')}
            </Button>
          ) : (
            <Button tone={tone} variant="quiet" disabled={translating} onClick={() => void translate()} className="min-h-[36px] text-t13">{t('translate')}</Button>
          )}
        </div>
      )}
      {messages.length === 0 && <p className="m-0 px-1 text-t13 text-mist">{t('empty')}</p>}
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {messages.map((m) => m.kind === 'SYSTEM' ? (
          <li key={m.id} className="self-center rounded-full bg-steel px-3 py-1 text-t12 text-ink-soft">
            {m.system ? t(systemKey(m.system.key, tone)) : ''}
          </li>
        ) : (
          <li key={m.id} className={cx('flex max-w-[85%] flex-col gap-1', m.mine ? 'self-end items-end' : 'self-start')}>
            {!m.mine && <span className="text-t11_5 font-bold text-mist">{m.senderLabel}</span>}
            <span className={cx('whitespace-pre-wrap break-words rounded-[16px] px-3.5 py-2.5 text-t14 leading-[1.7]', m.mine ? 'bg-night text-white' : 'border border-line bg-paper text-ink')}>
              {showTranslation && m.translation && !m.mine ? m.translation : m.content}
            </span>
            {showTranslation && m.translation && !m.mine && <span className="text-t11 text-mist">{t('translated')}</span>}
          </li>
        ))}
      </ol>
      <div ref={endRef} />
      <ErrorNote>{error}</ErrorNote>
      {open ? (
        <div className="sticky bottom-20 flex items-end gap-2 rounded-[16px] border border-line bg-paper p-2">
          <label className="sr-only" htmlFor={`compose-${caseId}`}>{t('message')}</label>
          <textarea
            id={`compose-${caseId}`}
            value={draft}
            maxLength={2000}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('message')}
            className="min-h-[48px] flex-1 resize-none rounded-tool px-2 py-2 text-t16 outline-none"
          />
          <Button tone={tone} variant="night" disabled={busy || !draft.trim()} onClick={() => void send()} className="min-h-[44px] px-4 text-t14">{t('send')}</Button>
        </div>
      ) : (
        <p className="m-0 px-1 text-t12_5 text-mist">{t('closed')}</p>
      )}
    </section>
  )
}
