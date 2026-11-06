'use client'

// 代理で相談を登録(盤 23)。本人から同意を得てから。登録したら引き継ぎコードを紙に書いて本人に渡す
import { Suspense, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/client/api'
import { optionsFor } from '@/lib/domain/intake'
import { Link } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Button, Card, cx, ErrorNote, Heading, Lead, TextArea, TextField, Tip } from '@/components/app/ui'
import { IndicatorPicker } from '@/components/consult/IndicatorPicker'

function Inner() {
  const t = useTranslations('support.proxy')
  const face = useSearchParams().get('face') ?? ''
  const [name, setName] = useState('')
  const [minor, setMinor] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [words, setWords] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string; code: string; expiresAt: string } | null>(null)

  return (
    <RequireMe>
      {(me) => {
        const submit = async () => {
          if (!name.trim() || minor === null || !words.trim() || !consent) {
            setError(t('required'))
            return
          }
          setBusy(true)
          setError(null)
          try {
            setDone(await apiFetch('/api/support/proxy', { method: 'POST', json: { face, displayName: name, isMinor: minor, country: me.person.country, regionCode: me.person.regionCode, indicators: selected, words, consent: true } }))
          } catch {
            setError(t('failed'))
          } finally {
            setBusy(false)
          }
        }
        return (
          <AppFrame tone="support">
            {done ? (
              <Card tone="support" className="flex flex-col gap-3 p-5">
                <span className="text-[16px] font-bold">{t('doneTitle', { name })}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold">{t('code')}</span>
                  <Tip label={t('codeTipLabel')}>{t('codeTip')}</Tip>
                </div>
                <span className="font-mono text-[32px] font-bold tracking-[0.2em]">{done.code}</span>
                <Lead>{t('handOnPaper', { date: done.expiresAt.slice(0, 10) })}</Lead>
                <Button tone="support" variant="outline" onClick={() => window.print()}>{t('print')}</Button>
                <Link href={`/cases/${done.id}`} className="text-[14px] font-bold text-night">{t('openCase')}</Link>
              </Card>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <Heading level={2}>{t('title')}</Heading>
                  <Tip kind="warn" label={t('tipLabel')}>{t('tip')}</Tip>
                </div>
                <Card tone="support" className="flex flex-col gap-4 p-4">
                  <TextField label={t('name')} hint={t('nameHint')} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-bold">{t('minor')}</span>
                    <div className="flex gap-2">
                      {[true, false].map((v) => (
                        <button key={String(v)} type="button" aria-pressed={minor === v} onClick={() => setMinor(v)} className={cx('min-h-[44px] flex-1 rounded-tool text-[14px] font-bold', minor === v ? 'border-2 border-night bg-lamp-soft' : 'border border-line-strong bg-paper')}>
                          {v ? t('yes') : t('no')}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
                <IndicatorPicker options={optionsFor('PERSON')} selected={selected} onChange={setSelected} subject="PERSON" />
                <p className="m-0 px-1 text-[12.5px] text-mist">{t('noneIsOk')}</p>
                <TextArea label={t('words')} value={words} maxLength={2000} onChange={(e) => setWords(e.target.value)} />
                <label className="flex min-h-[52px] items-center gap-3 rounded-tool border-[1.5px] border-line-strong bg-paper px-3">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5 accent-[#173A5E]" />
                  <span className="text-[13.5px] font-bold">{t('consent')}</span>
                </label>
                <ErrorNote>{error}</ErrorNote>
                <Button tone="support" variant="night" disabled={busy || !consent} onClick={() => void submit()}>{t('submit')}</Button>
              </>
            )}
          </AppFrame>
        )
      }}
    </RequireMe>
  )
}

export default function ProxyPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
