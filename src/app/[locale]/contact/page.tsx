'use client'

// お問い合わせ(最後のセーフティネット: 何度マッチングがうまくいかなくても運営につながれる)。
// 分類の値は DB と運営の画面のため日本語を正本にし、表示だけ訳す
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { Link } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { useSession } from '@/components/app/SessionProvider'
import { Button, Card, ErrorNote, Heading, Lead, TextArea, TextField } from '@/components/app/ui'

const CATEGORIES = {
  guest: [
    { id: 'aboutService', ja: 'サービスについて知りたい' },
    { id: 'joinAsSupporter', ja: '支援団体として参加したい' },
    { id: 'media', ja: '取材・メディア' },
    { id: 'other', ja: 'その他' },
  ],
  person: [
    { id: 'howto', ja: '使い方がわからない' },
    { id: 'stuck', ja: '相談が進まない・困っている' },
    { id: 'matchingComplaint', ja: '支え手とのやりとりに困っている' },
    { id: 'relink', ja: 'ログインの方法を付け替えたい' },
    { id: 'joinAsSupporter', ja: '支援団体として参加したい' },
    { id: 'other', ja: 'その他' },
  ],
} as const

const MESSAGE_MAX = 1000

export default function ContactPage() {
  const t = useTranslations('app.contact')
  const { state } = useSession()
  const loggedIn = state.status === 'ready'
  const categories = loggedIn ? CATEGORIES.person : CATEGORIES.guest
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const submit = async () => {
    if (!category || !message.trim() || (!loggedIn && (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))) {
      setError(t('required'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch<{ display_id: string }>('/api/contact', {
        method: 'POST',
        json: loggedIn ? { category, message } : { name, email, organization, category, message },
      })
      setDoneId(res.display_id)
    } catch {
      setError(t('failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppFrame tabs={loggedIn}>
      <Heading level={2}>{t('title')}</Heading>
      <Lead>{t('lead')}</Lead>
      {doneId ? (
        <Card className="flex flex-col gap-3 p-5">
          <span className="text-t16 font-bold">{t('doneTitle')}</span>
          <Lead>{t('doneBody')}</Lead>
          <span className="text-t13">{t('receipt')} <strong className="font-mono">{doneId}</strong></span>
          <Link href={loggedIn ? '/home' : '/'} className="text-t14 font-bold text-night">{t('back')}</Link>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-4">
          {!loggedIn && (
            <>
              <TextField label={t('name')} value={name} maxLength={64} onChange={(e) => setName(e.target.value)} />
              <TextField label={t('email')} type="email" autoComplete="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
              <TextField label={t('organization')} hint={t('optional')} value={organization} maxLength={64} onChange={(e) => setOrganization(e.target.value)} />
            </>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-t13 font-bold">{t('category')}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-t16">
              <option value="">{t('choose')}</option>
              {categories.map((c) => <option key={c.id} value={c.ja}>{t(`categories.${c.id}`)}</option>)}
            </select>
          </label>
          <TextArea label={t('message')} value={message} maxLength={MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} />
          <span className="self-end text-t12 text-mist">{message.length} / {MESSAGE_MAX}</span>
          {loggedIn && <p className="m-0 text-t12_5 text-mist">{t('loggedInNote')}</p>}
          <ErrorNote>{error}</ErrorNote>
          <Button variant="night" disabled={busy} onClick={() => void submit()}>{t('submit')}</Button>
        </Card>
      )}
    </AppFrame>
  )
}
