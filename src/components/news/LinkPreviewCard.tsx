// リンク先の OGP カード(サーバーコンポーネント)。画像・タイトル・説明・ドメインを見せて、
// 「どこへ飛ぶのか」が分かる状態で外部へ出す。取れなければドメインと URL だけのカード。
// 見た目は LinkCardView(管理画面のプレビューと共用)。
import { fetchLinkPreview } from '@/lib/news/linkPreview'
import { LinkCardView } from '@/components/news/LinkCardView'

export async function LinkPreviewCard({ url }: { url: string }) {
  const preview = await fetchLinkPreview(url)
  return <LinkCardView preview={preview} />
}
