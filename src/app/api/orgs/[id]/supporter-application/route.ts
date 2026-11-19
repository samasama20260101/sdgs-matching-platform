// 相談のための団体で、支え手の申し込みをする(#131。2026-11-17 代表了承)。
// 新しい団体の申し込み(POST /api/orgs の SUPPORT)と同じく、支え手の決まりへの同意と6つの自己採点が要り、18歳以上の人だけができる。
// 申し込めるのはその団体の管理の人だけ。申し込むと用途が SUPPORT になって審査の列に並び(APPLIED)、運営に知らせる。
// 承認されるまでは、支える側に審査中の団体として出る(新しい団体の申し込みと同じ)
// 新しい団体の申し込みと同じく、活動地域(全国か地域)を必ず選び、掲載台帳から選んだ行を申し込みに残す(#140。結ぶのは運営の承認のとき)
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { recordSupporterConsent } from '@/lib/server/consents'
import { notifyOps } from '@/lib/server/opsNotify'
import { myOrgRole } from '@/lib/server/orgAccess'
import { underSupporterAgeResponse } from '@/lib/server/supportAuth'
import { canSupportNow } from '@/lib/faces'
import { missingChecks } from '@/lib/domain/supporterChecks'
import { canApplyAsSupporter, supporterApplication } from '@/lib/domain/orgVetting'
import { withDirectoryEntry } from '@/lib/domain/directoryClaim'
import { SERVICE_AREAS_MAX, type ServiceAreas } from '@/lib/domain/serviceAreas'
import { isClaimableEntryId } from '@/lib/server/directoryClaim'
import { checkServiceAreas, saveServiceAreas } from '@/lib/server/serviceAreas'

const schema = z.object({
  contactEmail: z.string().email().max(254).nullable().optional(),
  application: z.record(z.string(), z.string().max(2000)),
  acceptSupporterTerms: z.boolean(),
  serviceAreas: z.object({ nationwide: z.boolean(), regionCodes: z.array(z.string().max(16)).max(SERVICE_AREAS_MAX * 2) }),
  directoryEntryId: z.string().uuid().nullable().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const input = parsed.data
  if (input.acceptSupporterTerms !== true) return NextResponse.json({ error: '同意が必要です', code: 'CONSENT_REQUIRED' }, { status: 400 })
  if (missingChecks(input.application).length > 0) return NextResponse.json({ error: '6つの点をすべて選んでください', code: 'CHECKS_REQUIRED' }, { status: 400 })
  if (!(await canSupportNow(auth.appUser.id))) return underSupporterAgeResponse()

  const role = await myOrgRole(auth.appUser.id, id)
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, display_id, name, org_type, region_country, prefecture, application, vetting_status, status')
    .eq('id', id)
    .maybeSingle()
  if (orgError) {
    console.error('[api/orgs/[id]/supporter-application] org', orgError)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canApplyAsSupporter({ application: org.application, vettingStatus: org.vetting_status as string, status: org.status as string, role })) {
    return NextResponse.json({ error: 'いまは支援団体として申し込めません', code: 'NOT_APPLICABLE' }, { status: 409 })
  }
  const country = (org.region_country as string | null) ?? 'JP'
  let areas: ServiceAreas
  try {
    const checked = await checkServiceAreas(country, input.serviceAreas)
    if (!checked.ok) return NextResponse.json({ error: '活動地域を確かめてください', code: checked.reason }, { status: 400 })
    areas = checked.value
    if (input.directoryEntryId && !(await isClaimableEntryId(input.directoryEntryId))) {
      return NextResponse.json({ error: '選んだ団体は、いまは選べません', code: 'DIRECTORY_ENTRY_UNAVAILABLE' }, { status: 409 })
    }
  } catch (e) {
    console.error('[api/orgs/[id]/supporter-application] check', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }

  // 同意を先に残す(同じ版は 1 行だけ。申し込みの書き換えに失敗しても害はない)
  try {
    await recordSupporterConsent(auth.appUser.id)
  } catch (e) {
    console.error('[api/orgs/[id]/supporter-application] consent', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }

  const answers = Object.fromEntries(Object.entries(input.application).filter(([, v]) => v.trim()))
  const contactEmail = input.contactEmail?.trim()
  // 2 回続けて押されても 1 回だけ通す(申し込み前の相談のための団体のときだけ書き換える)
  const { data: updated, error } = await supabaseAdmin
    .from('organizations')
    .update({
      application: withDirectoryEntry(supporterApplication(org.application, answers), input.directoryEntryId ?? null),
      vetting_status: 'APPLIED',
      applied_at: new Date().toISOString(),
      reception_status: 'ACCEPTING',
      ...(contactEmail ? { contact_email: contactEmail } : {}),
    })
    .eq('id', id)
    .eq('vetting_status', 'NOT_APPLIED')
    .eq('application->>purpose', 'CONSULT')
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[api/orgs/[id]/supporter-application] update', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ error: 'いまは支援団体として申し込めません', code: 'NOT_APPLICABLE' }, { status: 409 })
  // 地域の保存に失敗しても申し込みは受け付ける(団体の画面の「活動地域を変える」で直せる)
  await saveServiceAreas(id, auth.appUser.id, country, areas).catch((e) => console.error('[api/orgs/[id]/supporter-application] service areas', e))

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.appUser.id,
    organization_id: id,
    action: 'organization.supporter_application',
    target_table: 'organizations',
    target_id: id,
    metadata: { from: 'CONSULT' },
  })
  // 応答を待たせない(Discord が遅いと画面が待つため)
  after(async () => {
    const { data: region } = org.prefecture
      ? await supabaseAdmin.from('regions').select('name_local').eq('code', org.prefecture).maybeSingle()
      : { data: null }
    await notifyOps({
      kind: 'ORG_APPLICATION',
      organizationId: id,
      organizationDisplayId: org.display_id as string,
      name: org.name as string,
      orgType: org.org_type as string,
      country: (org.region_country as string | null) ?? null,
      regionName: (region?.name_local as string | undefined) ?? null,
    }).catch(() => undefined)
  })
  return NextResponse.json({ id })
}
