'use client'

// やりとり(相談する側のタブ)。支え手と一緒に進めている相談を、こちらが返す番のものから並べる(画面の見直し 所見 2)
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Heading } from '@/components/app/ui'
import type { MyCaseItem } from '@/components/consult/MyCases'
import { TalkRow } from '@/components/thread/TalkRow'
import { sortTalks } from '@/lib/domain/talk'

export default function TalkPage() {
  const t = useTranslations('consult.talk')
  const [items, setItems] = useState<MyCaseItem[] | null>(null)
  useEffect(() => {
    apiFetch<{ cases: MyCaseItem[] }>('/api/cases')
      .then((d) => setItems(sortTalks(d.cases.filter((c) => c.status === 'MATCHED' || c.status === 'RESOLVED'), 'CONSULTEE')))
      .catch(() => setItems([]))
  }, [])
  return (
    <RequireMe>
      {() => (
        <AppFrame>
          <Heading level={2}>{t('title')}</Heading>
          {items !== null && items.length === 0 && <p className="m-0 px-1 text-[13px] text-mist">{t('empty')}</p>}
          {(items ?? []).map((c) => (
            <TalkRow key={c.id} href={`/cases/${c.id}`} title={c.title} sub={c.subjectName} last={c.lastMessage} viewer="CONSULTEE" resolved={c.status === 'RESOLVED'} />
          ))}
        </AppFrame>
      )}
    </RequireMe>
  )
}
