// 団体を登録する(v2.0)。会社・地域として相談するための登録と、支え手の団体の申し込みの入口を兼ねる。
// 支え手の団体は「申し込み」(APPLIED)から始まり、一覧に載るのは運営の面談のあと(11/5 の審査の流れ)。
// 相談のための団体は審査に並べない(NOT_APPLIED、#131。src/lib/domain/orgVetting.ts)。
// 登録した人がその団体の管理者(OWNER)になる
// 支え手の団体は、活動地域(全国か地域)を必ず選ぶ。掲載台帳に同じ団体の行があれば、選んだ行を申し込みに残す
// (結ぶのは運営の承認のとき。#140、src/lib/domain/directoryClaim.ts)
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isCountryCode } from '@/lib/constants/countries'
import { recordSupporterConsent } from '@/lib/server/consents'
import { notifyOps } from '@/lib/server/opsNotify'
import { canSupportNow } from '@/lib/faces'
import { underSupporterAgeResponse } from '@/lib/server/supportAuth'
import { missingChecks } from '@/lib/domain/supporterChecks'
import { initialVettingStatus, newApplication } from '@/lib/domain/orgVetting'
import { withDirectoryEntry } from '@/lib/domain/directoryClaim'
import { SERVICE_AREAS_MAX, type ServiceAreas } from '@/lib/domain/serviceAreas'
import { isClaimableEntryId } from '@/lib/server/directoryClaim'
import { checkServiceAreas, saveServiceAreas } from '@/lib/server/serviceAreas'

const ORG_TYPES = ['NPO', 'NGO', 'COMPANY', 'MUNICIPALITY', 'COMMUNITY', 'SCHOOL', 'NATIONAL_AGENCY', 'OTHER_PUBLIC', 'INTERMEDIARY', 'PRO_BONO_LAWYER', 'OTHER'] as const

const schema = z.object({
  name: z.string().transform((v) => v.normalize('NFKC').trim()).pipe(z.string().min(1).max(100)),
  orgType: z.enum(ORG_TYPES),
  purpose: z.enum(['CONSULT', 'SUPPORT']),
  country: z.string().refine(isCountryCode),
  regionCode: z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional(),
  population: z.number().int().positive().max(2_000_000_000).nullable().optional(),
  // 全角の数字・空白・ハイフンは画面で除いてから送る
  corporateNumber: z.string().regex(/^\d{13}$/).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  application: z.record(z.string(), z.string().max(2000)).optional(),
  // 支え手の団体として申し込むときは「支える人と団体の決まり」への同意が要る
  acceptSupporterTerms: z.boolean().optional(),
  // 支え手の団体の活動地域(全国か地域の一覧。必ず選ぶ)
  serviceAreas: z.object({ nationwide: z.boolean(), regionCodes: z.array(z.string().max(16)).max(SERVICE_AREAS_MAX * 2) }).optional(),
  // 掲載台帳から「この団体です」と選んだ行(支え手の団体だけ)
  directoryEntryId: z.string().uuid().nullable().optional(),
})

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const input = parsed.data
  if (input.purpose === 'SUPPORT' && input.acceptSupporterTerms !== true) {
    return NextResponse.json({ error: '同意が必要です', code: 'CONSENT_REQUIRED' }, { status: 400 })
  }
  // 支え手の団体の申し込みは、面談で確かめる6つの点の自己採点がそろっていること(11/12 定例)
  if (input.purpose === 'SUPPORT' && missingChecks(input.application).length > 0) {
    return NextResponse.json({ error: '6つの点をすべて選んでください', code: 'CHECKS_REQUIRED' }, { status: 400 })
  }
  // 会社・地域として相談するための登録(CONSULT)は、18歳未満でもできる
  if (input.purpose === 'SUPPORT' && !(await canSupportNow(auth.appUser.id))) return underSupporterAgeResponse()
  // 支え手の団体は活動地域を必ず選ぶ(その国の地域だけ)。掲載台帳の行は、まだ結んでいない民間の団体の行だけを選べる
  let serviceAreas: ServiceAreas | null = null
  let directoryEntryId: string | null = null
  if (input.purpose === 'SUPPORT') {
    if (!input.serviceAreas) return NextResponse.json({ error: '活動地域を選んでください', code: 'AREAS_REQUIRED' }, { status: 400 })
    try {
      const checked = await checkServiceAreas(input.country, input.serviceAreas)
      if (!checked.ok) return NextResponse.json({ error: '活動地域を確かめてください', code: checked.reason }, { status: 400 })
      serviceAreas = checked.value
      if (input.directoryEntryId) {
        if (!(await isClaimableEntryId(input.directoryEntryId))) return NextResponse.json({ error: '選んだ団体は、いまは選べません', code: 'DIRECTORY_ENTRY_UNAVAILABLE' }, { status: 409 })
        directoryEntryId = input.directoryEntryId
      }
    } catch (e) {
      console.error('[api/orgs] check', e)
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
  }

  // 同じ人が短い間に団体を作りすぎない(機械の登録を止める)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin.from('organization_memberships').select('id', { count: 'exact', head: true }).eq('user_id', auth.appUser.id).eq('role', 'OWNER').gte('created_at', since)
  if ((count ?? 0) >= 5) return NextResponse.json({ error: '少し時間をおいてください', code: 'RATE_LIMIT' }, { status: 429 })

  const now = new Date().toISOString()
  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: input.name,
      org_type: input.orgType,
      vetting_status: initialVettingStatus(input.purpose),
      applied_at: input.purpose === 'SUPPORT' ? now : null,
      region_country: input.country,
      prefecture: input.regionCode ?? null,
      population: input.population ?? null,
      corporate_number: input.corporateNumber ?? null,
      contact_email: input.contactEmail ?? null,
      application: withDirectoryEntry(newApplication(input.purpose, input.application), directoryEntryId),
      reception_status: input.purpose === 'SUPPORT' ? 'ACCEPTING' : 'UNAVAILABLE',
      status: 'ACTIVE',
      display_id: '',
    })
    .select('id, display_id')
    .single()
  if (error) {
    console.error('[api/orgs] insert', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  const { error: mError } = await supabaseAdmin.from('organization_memberships').insert({
    organization_id: org.id,
    user_id: auth.appUser.id,
    role: 'OWNER',
    status: 'ACTIVE',
    joined_at: now,
  })
  if (mError) {
    console.error('[api/orgs] membership', mError)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  if (serviceAreas) {
    // 地域の保存に失敗しても申し込みは受け付ける(団体の画面の「活動地域を変える」で直せる。やり直すと団体が二重にできるため)
    await saveServiceAreas(org.id, auth.appUser.id, input.country, serviceAreas).catch((e) => console.error('[api/orgs] service areas', e))
  }
  if (input.purpose === 'SUPPORT') {
    // 申し込みは運営に知らせ、面談の日を決める(11/5 の審査の流れ: 申し込み → 運営へ → 面談 → 承認)
    await recordSupporterConsent(auth.appUser.id).catch((e) => console.error('[api/orgs] consent', e))
    // 応答を待たせない(Discord が遅いと画面が待つため)
    after(async () => {
      const { data: region } = input.regionCode
        ? await supabaseAdmin.from('regions').select('name_local').eq('code', input.regionCode).maybeSingle()
        : { data: null }
      await notifyOps({
        kind: 'ORG_APPLICATION',
        organizationId: org.id,
        organizationDisplayId: org.display_id,
        name: input.name,
        orgType: input.orgType,
        country: input.country,
        regionName: (region?.name_local as string | undefined) ?? null,
      }).catch(() => undefined)
    })
  }
  return NextResponse.json({ id: org.id, displayId: org.display_id })
}
