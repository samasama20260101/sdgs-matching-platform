'use client'

// 運営の入口。運営はメールのコードで入ったあと、認証アプリのコード(2つ目の確認)を必ず通す。
// 初めてのときはここで認証アプリを登録する(HANDOFF の申し送り 1: 管理者に MFA がない)。運営の画面は日本語だけ
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Link } from '@/i18n/navigation'
import { RequireMe } from '@/components/app/RequireMe'
import { useSession } from '@/components/app/SessionProvider'
import { Button, Card, ErrorNote, Heading, Lead, Screen, Spinner, TextField } from '@/components/app/ui'

type Enrollment = { factorId: string; qr: string; secret: string }

function MfaGate({ onVerified }: { onVerified: () => Promise<void> }) {
  const [loading, setLoading] = useState(true)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) {
      setError('認証アプリの状態を読めませんでした')
      setLoading(false)
      return
    }
    const verified = data.totp.find((f) => f.status === 'verified')
    if (verified) {
      setFactorId(verified.id)
    } else {
      // 登録の途中で止まった因子は消してから作り直す(同じ名前の因子が残ると登録できない)
      for (const f of data.all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'samasama-admin' })
      if (enrollError || !enrolled) {
        setError('認証アプリの登録を始められませんでした')
      } else {
        setEnrollment({ factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret })
        setFactorId(enrolled.id)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const verify = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError('6けたのコードを入れてください')
      return
    }
    setBusy(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (verifyError) {
      setError('コードが違います。認証アプリの今のコードを入れてください')
      return
    }
    await onVerified()
  }

  if (loading) return <Spinner />
  return (
    <Card tone="support" className="flex flex-col gap-4 p-5">
      <Heading level={2}>2つ目の確認</Heading>
      {enrollment ? (
        <>
          <Lead>運営の画面には、認証アプリ(Google Authenticator など)のコードが要ります。アプリでこの QR を読み取ってください。</Lead>
          {/* QR は Supabase Auth が返す SVG の data URL */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt="認証アプリに登録する QR コード" className="h-48 w-48 self-center rounded-tool border border-line bg-white p-2" />
          <p className="m-0 break-all text-[12px] text-mist">読み取れないときの文字列: <span className="font-mono">{enrollment.secret}</span></p>
        </>
      ) : (
        <Lead>認証アプリに出ている6けたのコードを入れてください。</Lead>
      )}
      <TextField label="認証アプリのコード" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} className="max-w-[200px]" />
      <ErrorNote>{error}</ErrorNote>
      <Button tone="support" variant="night" disabled={busy} onClick={() => void verify()}>確かめる</Button>
    </Card>
  )
}

const TOOLS = [
  { href: '/admin/news', title: 'お知らせ', note: '書く・公開する・AI の下書き' },
  { href: '/admin/mask-lab', title: '個人情報マスクの検証', note: 'AI に渡す前に伏せる処理を試す' },
] as const

export default function AdminHomePage() {
  const { refresh, signOut } = useSession()
  return (
    <RequireMe admin>
      {(me) => (
        <Screen tone="support">
          <div className="flex flex-col gap-4 py-6">
            <div className="flex items-center justify-between">
              <Heading level={2}>明日もsamasama ／ 運営</Heading>
              <Button tone="support" variant="outline" className="min-h-[40px] text-[13px]" onClick={() => void signOut()}>ログアウト</Button>
            </div>
            {!me.mfa.verified ? (
              <MfaGate onVerified={refresh} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {TOOLS.map((tool) => (
                  <Link key={tool.href} href={tool.href} className="no-underline">
                    <Card tone="support" className="flex flex-col gap-1 p-4 text-ink">
                      <span className="text-[15px] font-bold">{tool.title}</span>
                      <span className="text-[12.5px] text-mist">{tool.note}</span>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Screen>
      )}
    </RequireMe>
  )
}
