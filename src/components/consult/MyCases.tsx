'use client'

// わたしの相談の一覧(相談ごとの「いま」)。読み込みはホームが行い、ここは並べるだけ
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card, Chip, SectionLabel } from '@/components/app/ui'
import { talkTurn, type LastMessage } from '@/lib/domain/talk'
import { consulteeTitle } from '@/lib/domain/intake'
import { useIndicatorLabel } from '@/lib/client/indicatorLabel'

export type MyCaseItem = {
  id: string
  // 保存してある題(日本語)。画面には言語に合わせた題を出す(consulteeTitle)
  title: string
  firstIndicator: string | null
  // 本人の言葉の書き出し(40 字まで)
  ownWords: string | null
  status: 'OPEN' | 'MATCHED' | 'RESOLVED' | 'CLOSED' | 'CANCELLED'
  subjectType: 'PERSON' | 'COMPANY' | 'COMMUNITY' | 'NATION'
  subjectName: string | null
  pendingOffers: number
  isProxy: boolean
  // 最後のメッセージ(やりとりの一覧とホームの「あなたの番」)
  lastMessage: LastMessage | null
  createdAt: string
}

// 一覧(ホーム・あなたの番・やりとり)に出す題を、画面の言語で返す
export function useMyCaseTitle(): (item: MyCaseItem) => string {
  const locale = useLocale()
  const label = useIndicatorLabel()
  return (c) => consulteeTitle({ locale, savedTitle: c.title, firstIndicatorLabel: c.firstIndicator ? label(c.subjectType, c.firstIndicator) : null, ownWords: c.ownWords })
}

export function MyCases({ items }: { items: MyCaseItem[] }) {
  const t = useTranslations('app.home')
  const titleOf = useMyCaseTitle()
  if (items.length === 0) return <p className="m-0 px-1 text-t13 text-mist">{t('noCases')}</p>
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{t('myCases')}</SectionLabel>
      {items.map((c) => (
        <Link key={c.id} href={`/cases/${c.id}`} className="no-underline">
          <Card className="flex flex-col gap-1.5 p-3.5 text-ink">
            <span className="text-t14_5 font-bold">{titleOf(c)}</span>
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
