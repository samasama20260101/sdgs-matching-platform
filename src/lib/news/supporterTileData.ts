// 団体タイルのデータを DB から読む(サーバー専用)。公開している団体(ACTIVE)だけ。
import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/server'
import type { SupporterTileData } from '@/lib/news/supporterTile'

export async function getSupporterTileData(id: string): Promise<SupporterTileData | null> {
  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, supporter_type, bio, created_at')
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .maybeSingle()
  if (error || !org) return null

  const [{ count: resolvedCount }, { count: badgeCount }, { data: areas }] = await Promise.all([
    supabaseAdmin.from('offers').select('*', { count: 'exact', head: true }).eq('supporter_organization_id', org.id).eq('status', 'ACCEPTED'),
    supabaseAdmin.from('supporter_badges').select('*', { count: 'exact', head: true }).eq('supporter_organization_id', org.id),
    supabaseAdmin.from('supporter_service_areas').select('region_code, is_nationwide').eq('organization_id', org.id),
  ])
  const rows = (areas ?? []) as { region_code: string | null; is_nationwide: boolean }[]
  const codes = rows.filter((a) => a.region_code).map((a) => a.region_code as string)
  let names: string[] = []
  if (codes.length > 0) {
    const { data: regions } = await supabaseAdmin.from('regions').select('code, name_local').in('code', codes)
    const map = Object.fromEntries(((regions ?? []) as { code: string; name_local: string }[]).map((r) => [r.code, r.name_local]))
    names = codes.map((c) => map[c] ?? c)
  }
  return {
    id: org.id,
    name: org.name,
    supporterType: org.supporter_type,
    createdAt: org.created_at,
    bio: org.bio,
    resolvedCount: resolvedCount ?? 0,
    badgeCount: badgeCount ?? 0,
    nationwide: rows.some((a) => a.is_nationwide),
    areaNames: names,
  }
}
