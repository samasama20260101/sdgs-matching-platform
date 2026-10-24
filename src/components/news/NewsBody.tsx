// お知らせ本文(公開ページ用、サーバーコンポーネント)。描画の中身は NewsBodyView と共通で、
// 1 行だけの URL を、サイト内の団体ページなら団体タイル、それ以外は OGP カード(サーバーで取得)にする。
import { LinkPreviewCard } from '@/components/news/LinkPreviewCard'
import { NewsBodyView } from '@/components/news/NewsBodyView'
import { SupporterTile } from '@/components/news/SupporterTile'
import { supporterIdFromUrl } from '@/lib/news/supporterTile'

export function NewsBody({ body }: { body: string }) {
  return (
    <NewsBodyView
      body={body}
      renderLinkCard={(url, key) => {
        const supporterId = supporterIdFromUrl(url)
        return supporterId ? <SupporterTile key={key} id={supporterId} /> : <LinkPreviewCard key={key} url={url} />
      }}
    />
  )
}
