// 知る(盤 04 の「知る」タブ)。v2.0 ではお知らせを出し、社会課題の地図は段階2で足す
import { getTranslations } from 'next-intl/server'
import { getPublishedNews } from '@/lib/news/queries'
import { LearnView } from '@/components/app/LearnView'

export const dynamic = 'force-dynamic'

export default async function LearnPage() {
  const t = await getTranslations('app.learn')
  const news = await getPublishedNews(20)
  return <LearnView title={t('title')} news={news.map((n) => ({ id: n.id, title: n.title, publishedAt: n.published_at }))} />
}
