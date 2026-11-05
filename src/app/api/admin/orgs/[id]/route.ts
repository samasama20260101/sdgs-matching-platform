// 運営｜審査: 団体の状態を進める(面談の調整中・承認・見送り・停止)、面談のチェックリスト、コーディネーターの範囲。
// 審査は2段階に分けない(11/5)。承認すると一覧に載り、機微な相談も受けられる。操作はすべて監査ログに残す
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'

const schema = z.object({
  vettingStatus: z.enum(['APPLIED', 'INTERVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  note: z.string().max(2000).optional(),
  checklist: z.record(z.string(), z.union([z.boolean(), z.string().max(500)])).optional(),
  coordinatorRegion: z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [{ data: org }, { count: members }, { data: scopes }] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, display_id, name, org_type, vetting_status, vetting_note, applied_at, approved_at, application, interview_checklist, contact_email, region_country, prefecture, population, corporate_number').eq('id', id).maybeSingle(),
    supabaseAdmin.from('organization_memberships').select('id', { count: 'exact', head: true }).eq('organization_id', id).eq('status', 'ACTIVE'),
    supabaseAdmin.from('coordinator_scopes').select('id, region_country, region_code, theme').eq('organization_id', id),
  ])
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ organization: org, members: members ?? 0, coordinatorScopes: scopes ?? [] })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const p = parsed.data
  const update: Record<string, unknown> = {}
  if (p.vettingStatus) {
    update.vetting_status = p.vettingStatus
    if (p.vettingStatus === 'APPROVED') {
      update.approved_at = new Date().toISOString()
      update.approved_by_user_id = auth.appUser.id
      update.reception_status = 'ACCEPTING'
    }
  }
  if (p.note !== undefined) update.vetting_note = p.note
  if (p.checklist !== undefined) update.interview_checklist = p.checklist
  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from('organizations').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  // コーディネーター(市区町村と中間支援団体、11/5)。地域を1つ持たせる/外す
  if (p.coordinatorRegion !== undefined) {
    const { data: org } = await supabaseAdmin.from('organizations').select('org_type, vetting_status').eq('id', id).single()
    if (p.coordinatorRegion && (!org || !['MUNICIPALITY', 'INTERMEDIARY'].includes(org.org_type as string) || org.vetting_status !== 'APPROVED')) {
      return NextResponse.json({ error: 'コーディネーターにできるのは、承認済みの自治体と中間支援団体です', code: 'NOT_ALLOWED' }, { status: 400 })
    }
    await supabaseAdmin.from('coordinator_scopes').delete().eq('organization_id', id)
    if (p.coordinatorRegion) {
      await supabaseAdmin.from('coordinator_scopes').insert({ organization_id: id, region_country: p.coordinatorRegion.slice(0, 2), region_code: p.coordinatorRegion, created_by_user_id: auth.appUser.id })
    }
  }
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, organization_id: id, action: 'admin.organization_vetting', target_table: 'organizations', target_id: id, metadata: { ...update, coordinatorRegion: p.coordinatorRegion } })
  return NextResponse.json({ ok: true })
}
