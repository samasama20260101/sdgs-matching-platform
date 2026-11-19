// 運営｜審査: 団体の状態を進める(面談の調整中・承認・見送り・停止)、面談のチェックリスト、コーディネーターの範囲。
// 審査は2段階に分けない(11/5)。承認すると一覧に載り、機微な相談も受けられる。操作はすべて監査ログに残す。
// 相談のための団体は審査がなく、止める・止めるのを解くだけ(#131。変えられる先は src/lib/domain/orgVetting.ts の vettingTargets)
// 申し込みで掲載台帳の行を選んだ支援団体は、承認したときにその行と結ぶ(#140)。
//   directoryEntry: 'UNLINK' = 選んだ行を申し込みから外す(面談で別の団体と分かったとき。結んだあとは外さない)
//   directoryEntry: 'LINK'   = 承認済みでまだ結べていない行を結ぶ(承認のときに結べなかったときのやり直し)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isSupporterPurpose } from '@/lib/domain/publicSupporter'
import { VETTING_STATUSES, vettingTargets } from '@/lib/domain/orgVetting'
import { directoryEntryIdOf, withDirectoryEntry } from '@/lib/domain/directoryClaim'
import { linkDirectoryEntry, type LinkResult } from '@/lib/server/directoryClaim'

const schema = z.object({
  vettingStatus: z.enum(VETTING_STATUSES).optional(),
  note: z.string().max(2000).optional(),
  checklist: z.record(z.string(), z.union([z.boolean(), z.string().max(500)])).optional(),
  coordinatorRegion: z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional(),
  directoryEntry: z.enum(['LINK', 'UNLINK']).optional(),
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
  const { data: current, error: currentError } = await supabaseAdmin.from('organizations').select('org_type, vetting_status, application').eq('id', id).maybeSingle()
  if (currentError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supporter = isSupporterPurpose(current.application)
  const entryId = directoryEntryIdOf(current.application)
  const update: Record<string, unknown> = {}
  if (p.directoryEntry === 'UNLINK') {
    if (!entryId) return NextResponse.json({ error: '選んだ行がありません', code: 'NO_ENTRY' }, { status: 400 })
    // 結んだあとの行は外さない(行の名前・活動地域を書き換えているため。戻すときは audit_logs の前の値から手で戻す)
    const { data: entry, error: entryError } = await supabaseAdmin.from('directory_entries').select('claim_status, claimed_organization_id').eq('id', entryId).maybeSingle()
    if (entryError) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    if (entry?.claim_status === 'CLAIMED' && entry.claimed_organization_id === id) {
      return NextResponse.json({ error: '結んだあとの行は、この画面では外せません', code: 'ALREADY_LINKED' }, { status: 409 })
    }
    update.application = withDirectoryEntry((current.application ?? {}) as Record<string, unknown>, null)
  }
  if (p.directoryEntry === 'LINK') {
    if (!entryId) return NextResponse.json({ error: '選んだ行がありません', code: 'NO_ENTRY' }, { status: 400 })
    if (!supporter || current.vetting_status !== 'APPROVED') return NextResponse.json({ error: '結ぶのは承認した支援団体だけです', code: 'NOT_APPROVED' }, { status: 400 })
  }
  if (p.vettingStatus) {
    // 相談のための団体は承認しない(支え手の申し込みをしていない)。支え手の団体は申し込み前に戻さない
    if (!vettingTargets(current.application).includes(p.vettingStatus)) {
      return NextResponse.json({ error: supporter ? 'この状態にはできません' : '相談のための団体は、止めるか止めるのを解くだけです', code: 'NOT_ALLOWED' }, { status: 400 })
    }
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
    // コーディネーターは支える側の役割なので、支え手の団体だけ(相談のための団体はならない)
    const status = (update.vetting_status as string | undefined) ?? current.vetting_status
    if (p.coordinatorRegion && (!supporter || !['MUNICIPALITY', 'INTERMEDIARY'].includes(current.org_type as string) || status !== 'APPROVED')) {
      return NextResponse.json({ error: 'コーディネーターにできるのは、承認済みの支援団体のうち、自治体と中間支援団体です', code: 'NOT_ALLOWED' }, { status: 400 })
    }
    await supabaseAdmin.from('coordinator_scopes').delete().eq('organization_id', id)
    if (p.coordinatorRegion) {
      await supabaseAdmin.from('coordinator_scopes').insert({ organization_id: id, region_country: p.coordinatorRegion.slice(0, 2), region_code: p.coordinatorRegion, created_by_user_id: auth.appUser.id })
    }
  }
  // 申し込みの中身(application)は記録に写さない(選んだ行を外したことは directoryEntry で分かる)
  const { application: _application, ...logged } = update
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, organization_id: id, action: 'admin.organization_vetting', target_table: 'organizations', target_id: id, metadata: { ...logged, coordinatorRegion: p.coordinatorRegion, directoryEntry: p.directoryEntry, directoryEntryId: entryId } })
  // 承認した支援団体が掲載台帳の行を選んでいれば、その行と結ぶ(結べなくても承認は取り消さない。結果を画面に返す)
  let directoryLink: LinkResult | 'FAILED' | null = null
  if (entryId && supporter && p.directoryEntry !== 'UNLINK' && (p.directoryEntry === 'LINK' || p.vettingStatus === 'APPROVED')) {
    directoryLink = await linkDirectoryEntry(id, auth.appUser.id).catch((e) => {
      console.error('[api/admin/orgs/[id]] directory link', e)
      return 'FAILED' as const
    })
  }
  return NextResponse.json({ ok: true, directoryLink })
}
