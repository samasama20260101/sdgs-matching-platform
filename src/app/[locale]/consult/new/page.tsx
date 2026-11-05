'use client'

// 相談を書く(個人。盤 12・12b)
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { WriteFlow } from '@/components/consult/WriteFlow'

function Inner() {
  const params = useSearchParams()
  return (
    <RequireMe>
      {(me) => (
        <AppFrame tabs={false}>
          <WriteFlow subject="PERSON" country={me.person.country} entryCode={params.get('shop')} />
        </AppFrame>
      )}
    </RequireMe>
  )
}

export default function ConsultNewPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
