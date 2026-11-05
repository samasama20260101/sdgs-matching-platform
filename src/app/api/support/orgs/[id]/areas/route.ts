// 団体の活動地域を入れ替える(管理の人だけ)。PUT { nationwide, regionCodes } → { areas }
// 地域はその団体の国のものだけ。入れ替えは DB の set_organization_service_areas で 1 回で行う(v2_11)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { myOrgRole } from '@/lib/server/orgAccess'
import { normalizeServiceAreaInput, regionLevelFor, SERVICE_AREAS_MAX } from '@/lib/domain/serviceAreas'

const schema = z.object({
  nationwide: z.boolean(),
  regionCodes: z.array(z.string().max(16)).max(SERVICE_AREAS_MAX * 2),
})

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((await myOrgRole(auth.appUser.id, id)) !== 'OWNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })

  const { data: org, error: orgError } = await supabaseAdmin.from('organizations').select('region_country').eq('id', id).single()
  if (orgError) return serverError('org', orgError)
  const country = (org.region_country as string | null) ?? 'JP'
  const { data: regions, error: regionError } = await supabaseAdmin
    .from('regions')
    .select('code')
    .eq('country', country)
    .eq('level', regionLevelFor(country))
    .order('sort_order', { ascending: true })
  if (regionError) return serverError('regions', regionError)

  const checked = normalizeServiceAreaInput(parsed.data, (regions ?? []).map((r) => r.code as string))
  if (!checked.ok) return NextResponse.json({ error: '活動地域を確かめてください', code: checked.reason }, { status: 400 })

  const { error } = await supabaseAdmin.rpc('set_organization_service_areas', {
    p_org_id: id,
    p_user_id: auth.appUser.id,
    p_country: country,
    p_nationwide: checked.value.nationwide,
    p_region_codes: checked.value.regionCodes,
  })
  if (error) return serverError('rpc', error)
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.appUser.id,
    organization_id: id,
    action: 'organization.service_areas',
    target_table: 'supporter_service_areas',
    target_id: id,
    metadata: { nationwide: checked.value.nationwide, count: checked.value.regionCodes.length },
  })
  return NextResponse.json({ areas: { registered: true, country, ...checked.value } })
}

function serverError(where: string, error: unknown) {
  console.error(`[api/support/orgs/[id]/areas] ${where}`, error)
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}
