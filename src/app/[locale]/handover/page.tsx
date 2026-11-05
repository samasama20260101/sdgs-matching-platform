'use client'

// 引き継ぎコードを入れて、団体が代理で登録した相談を自分の相談にする(盤 23)
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch, ApiError } from '@/lib/client/api'
import { useRouter } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Button, Card, ErrorNote, Heading, Lead, TextField } from '@/components/app/ui'

export default function HandoverPage() {
  const t = useTranslations('consult.handover')
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await apiFetch<{ caseId: string }>('/api/handover', { method: 'POST', json: { code } })
      router.replace(`/cases/${r.caseId}`)
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'RATE_LIMIT' ? t('rateLimit') : t('wrong'))
      setBusy(false)
    }
  }
  return (
    <RequireMe>
      {() => (
        <AppFrame>
          <Heading level={2}>{t('title')}</Heading>
          <Lead>{t('lead')}</Lead>
          <Card className="flex flex-col gap-3 p-4">
            <TextField label={t('code')} value={code} maxLength={14} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={(e) => setCode(e.target.value.toUpperCase())} className="max-w-[260px] tracking-[0.08em]" />
            <ErrorNote>{error}</ErrorNote>
            <Button variant="night" disabled={busy || code.replace(/[^0-9A-Z]/g, '').length < 6} onClick={() => void submit()}>{t('submit')}</Button>
          </Card>
        </AppFrame>
      )}
    </RequireMe>
  )
}
