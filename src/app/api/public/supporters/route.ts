// 公開の団体一覧(ログイン不要)。載せる決まりと集計は src/lib/server/publicSupporters.ts の 1 か所だけ
import { NextResponse } from 'next/server'
import { listPublicSupporters } from '@/lib/server/publicSupporters'

export async function GET() {
  try {
    const supporters = await listPublicSupporters({ limit: 100 })
    return NextResponse.json({
      supporters: supporters.map((s) => ({
        id: s.id,
        display_name: s.name,
        organization_name: s.name,
        supporter_type: s.supporterType,
        resolved_count: s.resolvedCount,
        badge_count: s.badgeCount,
        service_area_nationwide: s.nationwide,
        service_areas: s.areas,
      })),
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (error) {
    console.error('[api/public/supporters]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました', supporters: [] }, { status: 500 })
  }
}
