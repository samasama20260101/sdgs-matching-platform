'use client'

// 相談を書く(個人。盤 12・12b)。ログインしていなくても書け、届けるときにログインする(2026-11-17 岡本さん)
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { OptionalMe } from '@/components/app/RequireMe'
import { WriteFlow } from '@/components/consult/WriteFlow'

function Inner() {
  const params = useSearchParams()
  return (
    <OptionalMe>
      {(me) => (
        <AppFrame tabs={false}>
          <WriteFlow subject="PERSON" entryCode={params.get('shop')} signedIn={me !== null} />
        </AppFrame>
      )}
    </OptionalMe>
  )
}

export default function ConsultNewPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
