'use client'

// やりとり(相談する側のタブ)。支え手と一緒に進めている相談の一覧
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { apiFetch } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, Heading } from '@/components/app/ui'
import type { MyCaseItem } from '@/components/consult/MyCases'

export default function TalkPage() {
  const t = useTranslations('consult.talk')
  const [items, setItems] = useState<MyCaseItem[] | null>(null)
  useEffect(() => {
    apiFetch<{ cases: MyCaseItem[] }>('/api/cases').then((d) => setItems(d.cases.filter((c) => c.status === 'MATCHED' || c.status === 'RESOLVED'))).catch(() => setItems([]))
  }, [])
  return (
    <RequireMe>
      {() => (
        <AppFrame>
          <Heading level={2}>{t('title')}</Heading>
          {items !== null && items.length === 0 && <p className="m-0 px-1 text-[13px] text-mist">{t('empty')}</p>}
          {(items ?? []).map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="no-underline">
              <Card className="flex flex-col gap-1 p-3.5 text-ink">
                <span className="text-[14.5px] font-bold">{c.title}</span>
                <span className="text-[12px] text-mist">{c.subjectName ?? ''}</span>
              </Card>
            </Link>
          ))}
        </AppFrame>
      )}
    </RequireMe>
  )
}
