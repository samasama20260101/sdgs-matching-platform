import 'server-only'

// 団体の活動地域(全国か地域の一覧)を確かめて入れ替える。団体の画面の「活動地域を変える」と、
// 支援団体の申し込み(登録のときに全国か地域かを必ず選ぶ、#140)で同じものを使う。
// 地域はその団体の国のものだけ。入れ替えは DB の set_organization_service_areas で 1 回で行う(v2_11)
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeServiceAreaInput, regionLevelFor, type ServiceAreaInputError, type ServiceAreas } from '@/lib/domain/serviceAreas'

export async function checkServiceAreas(
  country: string,
  input: { nationwide: boolean; regionCodes: string[] },
): Promise<{ ok: true; value: ServiceAreas } | { ok: false; reason: ServiceAreaInputError }> {
  const { data: regions, error } = await supabaseAdmin
    .from('regions')
    .select('code')
    .eq('country', country)
    .eq('level', regionLevelFor(country))
    .order('sort_order', { ascending: true })
  if (error) throw error
  return normalizeServiceAreaInput(input, (regions ?? []).map((r) => r.code as string))
}

export async function saveServiceAreas(organizationId: string, userId: string, country: string, areas: ServiceAreas): Promise<void> {
  const { error } = await supabaseAdmin.rpc('set_organization_service_areas', {
    p_org_id: organizationId,
    p_user_id: userId,
    p_country: country,
    p_nationwide: areas.nationwide,
    p_region_codes: areas.regionCodes,
  })
  if (error) throw error
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: userId,
    organization_id: organizationId,
    action: 'organization.service_areas',
    target_table: 'supporter_service_areas',
    target_id: organizationId,
    metadata: { nationwide: areas.nationwide, count: areas.regionCodes.length },
  })
}
