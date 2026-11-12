'use client'

// 相談する｜ホーム(盤 13 の前): 一番上に「あなたの番」(届いた申し出・返事)、その下に相談を書く入口と相談ごとの「いま」
// (画面の見直し 所見 7)
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { apiFetch } from '@/lib/client/api'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { MyCases, useMyCaseTitle, type MyCaseItem } from '@/components/consult/MyCases'
import { Card, Heading, Lead, SectionLabel } from '@/components/app/ui'
import { talkTurn } from '@/lib/domain/talk'

function YourTurn({ items }: { items: MyCaseItem[] }) {
  const t = useTranslations('app.home')
  const titleOf = useMyCaseTitle()
  const rows = [
    ...items.filter((c) => c.status === 'OPEN' && c.pendingOffers > 0).map((c) => ({ id: c.id, title: titleOf(c), label: t('turnOffers', { count: c.pendingOffers }) })),
    ...items.filter((c) => c.status === 'MATCHED' && talkTurn(c.lastMessage, 'CONSULTEE') === 'mine').map((c) => ({ id: c.id, title: titleOf(c), label: t('turnReply') })),
  ]
  if (rows.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{t('yourTurn', { count: rows.length })}</SectionLabel>
      {rows.map((r) => (
        <Link key={`${r.id}-${r.label}`} href={`/cases/${r.id}`} className="no-underline">
          <Card className="flex items-center justify-between gap-3 border-night p-3.5 text-ink">
            <span className="flex min-w-0 flex-col">
              <span className="text-t13 font-bold text-night">{r.label}</span>
              <span className="truncate text-t14">{r.title}</span>
            </span>
            <span aria-hidden>›</span>
          </Card>
        </Link>
      ))}
    </section>
  )
}

export default function HomePage() {
  const t = useTranslations('app.home')
  const [items, setItems] = useState<MyCaseItem[] | null>(null)
  useEffect(() => {
    apiFetch<{ cases: MyCaseItem[] }>('/api/cases').then((d) => setItems(d.cases)).catch(() => setItems([]))
  }, [])
  return (
    <RequireMe>
      {(me) => (
        <AppFrame>
          <div className="flex flex-col gap-1 px-1">
            <Heading level={2}>{t('hello', { name: me.person.displayName })}</Heading>
            <Lead>{t('lead')}</Lead>
          </div>
          {items && <YourTurn items={items} />}
          <Link href="/consult/new" className="flex min-h-[56px] items-center justify-center rounded-[16px] bg-lamp text-t16 font-bold tracking-[0.1em] text-ink no-underline">
            {t('write')}
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/consult/org?subject=COMPANY" className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-line bg-paper text-t13_5 font-bold text-ink no-underline">{t('asCompany')}</Link>
            <Link href="/consult/org?subject=COMMUNITY" className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-line bg-paper text-t13_5 font-bold text-ink no-underline">{t('asCommunity')}</Link>
          </div>
          {items && <MyCases items={items} />}
        </AppFrame>
      )}
    </RequireMe>
  )
}
