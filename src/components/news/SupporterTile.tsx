// 団体タイル(公開ページ用、サーバーコンポーネント)。団体が見つからない(取り下げ等)ときは何も出さない。
import { getSupporterTileData } from '@/lib/news/supporterTileData'
import { SupporterTileView } from '@/components/news/SupporterTileView'

export async function SupporterTile({ id }: { id: string }) {
  const data = await getSupporterTileData(id)
  return data ? <SupporterTileView data={data} /> : null
}
