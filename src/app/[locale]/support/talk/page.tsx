'use client'

// 支える｜やりとり: その立場で関わっている相談
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { Heading } from '@/components/app/ui'
import { CaseCard } from '@/components/support/CaseCard'
import { FacePicker, useFace } from '@/components/support/useFace'
import type { SupportCaseItem } from '@/lib/server/supportCases'

function Talk() {
  const t = useTranslations('support.talk')
  const { options, current, choose } = useFace()
  const [items, setItems] = useState<SupportCaseItem[] | null>(null)
  useEffect(() => {
    if (!current) return
    apiFetch<{ cases: SupportCaseItem[] }>(`/api/support/involved?face=${encodeURIComponent(current.key)}`).then((d) => setItems(d.cases)).catch(() => setItems([]))
  }, [current])
  return (
    <>
      <FacePicker options={options} current={current} onChoose={choose} />
      <Heading level={2}>{t('title')}</Heading>
      {items && items.length === 0 && <p className="m-0 px-1 text-[13px] text-mist">{t('empty')}</p>}
      {(items ?? []).map((c) => <CaseCard key={c.id} item={c} face={current?.key ?? ''} />)}
    </>
  )
}

export default function SupportTalkPage() {
  return <RequireMe>{() => <AppFrame tone="support"><Talk /></AppFrame>}</RequireMe>
}
