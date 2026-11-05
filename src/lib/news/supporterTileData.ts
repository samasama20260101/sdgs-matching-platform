// お知らせの団体の札のデータ(サーバー専用)。載せる決まりは公開の団体一覧と同じ(src/lib/server/publicSupporters.ts)。
// 審査前・見送り・相談のために登録した団体は出さない
import 'server-only'

import { listPublicSupporters } from '@/lib/server/publicSupporters'
import type { SupporterTileData } from '@/lib/news/supporterTile'

export async function getSupporterTileData(id: string): Promise<SupporterTileData | null> {
  const [s] = await listPublicSupporters({ ids: [id], limit: 1 }).catch(() => [])
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    supporterType: s.supporterType,
    createdAt: s.createdAt,
    bio: s.bio,
    resolvedCount: s.resolvedCount,
    badgeCount: s.badgeCount,
    nationwide: s.nationwide,
    areaNames: s.areas.map((a) => a.name_local),
  }
}
