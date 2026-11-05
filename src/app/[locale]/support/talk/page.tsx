'use client'

// 支える｜やりとり: その立場で関わっている相談を、こちらが返す番のものから並べる(画面の見直し 所見 2)
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Heading } from '@/components/app/ui'
import { TalkRow } from '@/components/thread/TalkRow'
import { sortTalks } from '@/lib/domain/talk'
import { FacePicker, useFace } from '@/components/support/useFace'
import type { SupportCaseItem } from '@/lib/server/supportCases'

function Talk() {
  const t = useTranslations('support.talk')
  const { options, current, choose } = useFace()
  const [items, setItems] = useState<SupportCaseItem[] | null>(null)
  useEffect(() => {
    if (!current) return
    apiFetch<{ cases: SupportCaseItem[] }>(`/api/support/involved?face=${encodeURIComponent(current.key)}`).then((d) => setItems(sortTalks(d.cases.filter((c) => !c.locked), 'SUPPORTER'))).catch(() => setItems([]))
  }, [current])
  return (
    <>
      <FacePicker options={options} current={current} onChoose={choose} />
      <Heading level={2}>{t('title')}</Heading>
      {items && items.length === 0 && <p className="m-0 px-1 text-[13px] text-mist">{t('empty')}</p>}
      {(items ?? []).map((c) => (
        <TalkRow key={c.id} href={`/support/cases/${c.id}?face=${encodeURIComponent(current?.key ?? '')}`} title={c.title ?? ''} sub={c.subjectName} last={c.lastMessage} viewer="SUPPORTER" resolved={c.status === 'RESOLVED'} />
      ))}
    </>
  )
}

export default function SupportTalkPage() {
  return <RequireMe>{() => <AppFrame tone="support"><Talk /></AppFrame>}</RequireMe>
}
