// お知らせ本文(公開ページ用、サーバーコンポーネント)。描画の中身は NewsBodyView と共通で、
// 1 行だけの URL を OGP カード(サーバーで取得)にする所だけがここの役目。
import { LinkPreviewCard } from '@/components/news/LinkPreviewCard'
import { NewsBodyView } from '@/components/news/NewsBodyView'

export function NewsBody({ body }: { body: string }) {
  return <NewsBodyView body={body} renderLinkCard={(url, key) => <LinkPreviewCard key={key} url={url} />} />
}
