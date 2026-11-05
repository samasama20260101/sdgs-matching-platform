// 公開の団体ページ(ログイン不要)。載せる決まりと集計は src/lib/server/publicSupporters.ts の 1 か所だけ
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isUuid } from '@/lib/api/validation'
import { listPublicSupporters } from '@/lib/server/publicSupporters'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    let [supporter] = await listPublicSupporters({ ids: [id], limit: 1 })
    // 旧 URL(/supporters/{user_id})から来た場合の互換(本の相談所など外からのリンクが残っている)
    if (!supporter) {
      const { data: membership } = await supabaseAdmin
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', id)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle()
      if (membership?.organization_id) [supporter] = await listPublicSupporters({ ids: [membership.organization_id as string], limit: 1 })
    }
    if (!supporter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: badges } = await supabaseAdmin
      .from('supporter_badges')
      .select('badge_key, created_at')
      .eq('supporter_organization_id', supporter.id)
      .order('created_at', { ascending: false })
    const badgeSummary: Record<string, number> = {}
    for (const b of badges ?? []) badgeSummary[b.badge_key as string] = (badgeSummary[b.badge_key as string] ?? 0) + 1

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
