// 公開の団体ページ(ログイン不要)。載せる決まりと集計は src/lib/server/publicSupporters.ts の 1 か所だけ
import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/api/validation'
import { findPublicSupporter, publicThanksWords } from '@/lib/server/publicSupporters'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const supporter = await findPublicSupporter(id)
    if (!supporter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const badgeSummary = await publicThanksWords(supporter.id)

    return NextResponse.json({
      supporter: {
        id: supporter.id,
        display_name: supporter.name,
        organization_name: supporter.name,
        supporter_type: supporter.supporterType,
        bio: supporter.bio,
        social_links: supporter.socialLinks,
        created_at: supporter.createdAt,
        resolved_count: supporter.resolvedCount,
        service_area_nationwide: supporter.nationwide,
        service_areas: supporter.areas,
      },
      badges: badgeSummary,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[api/public/supporters/[id]]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
