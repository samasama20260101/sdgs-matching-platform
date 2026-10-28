// トップページ。お知らせだけサーバーで読んでから渡す(ブラウザで後から取ると、欄が遅れて現れて下の内容がずれるため)。
// 公開・下書き戻しをすぐ反映させるため、/news と同じく毎回 DB を読む(読むのは公開中の新しい 3 件だけ)。
import HomePage from './HomePage'
import { NEWS_TOP_LIMIT } from '@/lib/constants/news'
import { getPublishedNews } from '@/lib/news/queries'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const newsPosts = await getPublishedNews(NEWS_TOP_LIMIT)
  return <HomePage newsPosts={newsPosts} />
}
