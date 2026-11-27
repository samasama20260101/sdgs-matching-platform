// 相談する｜ホーム。画面は HomeView。相談がまだない人に出す支援団体とお知らせ(#177)はサーバーで読んで渡す
// (公開の一覧・お知らせと同じ決まりで、公開してよいものだけ)
import { HomeView } from '@/components/consult/HomeView'
import { HOME_NEWS_ITEMS } from '@/lib/domain/emptyStates'
import { getPublishedNews } from '@/lib/news/queries'
import { listPublicSupporters } from '@/lib/server/publicSupporters'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [news, supporters] = await Promise.all([
    getPublishedNews(HOME_NEWS_ITEMS),
    listPublicSupporters({ limit: 100 }).catch((error) => {
      console.error('[home] supporters', error)
      return []
    }),
  ])
  return (
    <HomeView
      news={news.map((n) => ({ id: n.id, title: n.title, category: n.category, publishedAt: n.published_at }))}
      supporters={supporters.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.supporterType,
        nationwide: s.nationwide,
        areas: s.areas.map((a) => ({ region_code: a.region_code, name_local: a.name_local, name_en: a.name_en })),
      }))}
    />
  )
}
