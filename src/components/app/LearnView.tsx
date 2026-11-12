'use client'

// 知る: お知らせの一覧。社会課題の地図・指標のページは段階2(キャンバス盤 40・41)。準備中の案内は出さない
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AppFrame } from './AppShell'
import { Card, Heading } from './ui'

export function LearnView({ title, news }: { title: string; news: { id: string; title: string; publishedAt: string | null }[] }) {
  const t = useTranslations('app.learn')
  return (
    <AppFrame>
      <Heading level={2}>{title}</Heading>
      <span className="px-1 text-t12_5 font-bold text-mist">{t('news')}</span>
      {news.length === 0 && <p className="m-0 px-1 text-t13 text-mist">{t('noNews')}</p>}
      {news.map((n) => (
        <Link key={n.id} href={`/news/${n.id}`} className="no-underline">
          <Card className="flex flex-col gap-1 p-3.5 text-ink">
            <span className="text-t12 text-mist">{n.publishedAt?.slice(0, 10)}</span>
            <span className="text-t14_5 font-bold">{n.title}</span>
          </Card>
        </Link>
      ))}
    </AppFrame>
  )
}
