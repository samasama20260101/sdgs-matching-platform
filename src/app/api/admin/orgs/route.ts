// 運営｜審査(盤 51): 団体の申し込みの一覧。?status=APPLIED|INTERVIEW|APPROVED|REJECTED|SUSPENDED|NOT_APPLIED
// NOT_APPLIED は相談のための団体(審査に並べない、#131)。止めるために一覧で引けるようにしておく
// 札ごとに、登録で選んだ活動地域と、掲載台帳から選んだ行(と結べるか)を付ける(#140)
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { VETTING_STATUSES } from '@/lib/domain/orgVetting'
import { loadAdminDirectoryEntries, loadAdminServiceAreas } from '@/lib/server/directoryClaim'
import { photoUrlOf } from '@/lib/server/supporterPhotos'

const STATUSES: readonly string[] = VETTING_STATUSES

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const status = new URL(request.url).searchParams.get('status') ?? 'APPLIED'
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  // 一覧と、審査の段階ごとの件数を並べて読む。消した団体(ARCHIVED)は出さない(運営の画面の件数 /api/admin/counts と同じ)
  const [{ data, error }, ...countResults] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, display_id, name, org_type, vetting_status, applied_at, approved_at, application, contact_email, region_country, prefecture, population, created_at, photo_path')
      .eq('vetting_status', status)
      .neq('status', 'ARCHIVED')
      .order('created_at', { ascending: false })
      .limit(200),
    ...STATUSES.map((s) => supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('vetting_status', s).neq('status', 'ARCHIVED')),
  ])
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map((s, i) => [s, countResults[i].count ?? 0]))
  const orgs = data ?? []
  try {
    const [entries, areas] = await Promise.all([
      loadAdminDirectoryEntries(orgs.map((o) => ({ id: o.id as string, application: o.application }))),
      loadAdminServiceAreas(orgs.map((o) => o.id as string)),
    ])
    // 写真は置き場所でなく公開のアドレスで返す(#178。合わない写真を運営が外せるように見せる)
    const organizations = orgs.map(({ photo_path: photoPath, ...o }) => ({ ...o, photo_url: photoUrlOf(photoPath as string | null), directory_entry: entries.get(o.id as string) ?? null, service_areas: areas.get(o.id as string) ?? null }))
    return NextResponse.json({ organizations, counts })
  } catch (e) {
    console.error('[api/admin/orgs] directory', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
