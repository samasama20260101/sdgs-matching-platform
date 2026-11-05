'use client'

// わたしの相談の一覧(相談ごとの「いま」)。読み込みはホームが行い、ここは並べるだけ
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card, Chip, SectionLabel } from '@/components/app/ui'
import { talkTurn, type LastMessage } from '@/lib/domain/talk'

export type MyCaseItem = {
  id: string
  title: string
  status: 'OPEN' | 'MATCHED' | 'RESOLVED' | 'CLOSED' | 'CANCELLED'
  subjectType: 'PERSON' | 'COMPANY' | 'COMMUNITY' | 'NATION'
  subjectName: string | null
  pendingOffers: number
  isProxy: boolean
  // 最後のメッセージ(やりとりの一覧とホームの「あなたの番」)
  lastMessage: LastMessage | null
  createdAt: string
}

export function MyCases({ items }: { items: MyCaseItem[] }) {
  const t = useTranslations('app.home')
  if (items.length === 0) return <p className="m-0 px-1 text-[13px] text-mist">{t('noCases')}</p>
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{t('myCases')}</SectionLabel>
      {items.map((c) => (
        <Link key={c.id} href={`/cases/${c.id}`} className="no-underline">
          <Card className="flex flex-col gap-1.5 p-3.5 text-ink">
            <span className="text-[14.5px] font-bold">{c.title}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <Chip color={c.status === 'RESOLVED' ? 'leaf' : c.status === 'MATCHED' ? 'dawn' : c.status === 'OPEN' ? 'lamp' : 'steel'}>{t(`status.${c.status}`)}</Chip>
              {c.isProxy && <Chip color="dawn">{t('proxy')}</Chip>}
              {c.subjectName && <Chip>{c.subjectName}</Chip>}
              {c.pendingOffers > 0 && <Chip color="night">{t('newOffers', { count: c.pendingOffers })}</Chip>}
              {c.status === 'MATCHED' && talkTurn(c.lastMessage, 'CONSULTEE') === 'mine' && <Chip color="night">{t('replyArrived')}</Chip>}
            </span>
          </Card>
        </Link>
      ))}
    </section>
  )
}
