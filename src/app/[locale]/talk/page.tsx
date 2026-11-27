// やりとり(相談する側のタブ)。画面は TalkView。まだやりとりがない人に出す「支援の現場から」(新しいインタビュー、#177)はサーバーで読んで渡す
import { TalkView } from '@/components/consult/TalkView'
import { getPublishedNewsInCategory } from '@/lib/news/queries'

export const dynamic = 'force-dynamic'

export default async function TalkPage() {
  const [interview] = await getPublishedNewsInCategory('INTERVIEW', 1)
  return <TalkView interview={interview ? { id: interview.id, title: interview.title, category: interview.category, publishedAt: interview.published_at } : null} />
}
