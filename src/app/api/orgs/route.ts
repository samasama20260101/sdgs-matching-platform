// 団体を登録する(v2.0)。会社・地域として相談するための登録と、支え手の団体の申し込みの入口を兼ねる。
// どちらも「申し込み」(APPLIED)から始まり、支え手として一覧に載るのは運営の面談のあと(11/5 の審査の流れ)。
// 登録した人がその団体の管理者(OWNER)になる
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isCountryCode } from '@/lib/constants/countries'
import { recordSupporterConsent } from '@/lib/server/consents'
import { notifyOps } from '@/lib/server/opsNotify'

const ORG_TYPES = ['NPO', 'NGO', 'COMPANY', 'MUNICIPALITY', 'COMMUNITY', 'SCHOOL', 'NATIONAL_AGENCY', 'OTHER_PUBLIC', 'INTERMEDIARY', 'PRO_BONO_LAWYER', 'OTHER'] as const

const schema = z.object({
  name: z.string().transform((v) => v.normalize('NFKC').trim()).pipe(z.string().min(1).max(100)),
  orgType: z.enum(ORG_TYPES),
  purpose: z.enum(['CONSULT', 'SUPPORT']),
  country: z.string().refine(isCountryCode),
  regionCode: z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional(),
  population: z.number().int().positive().max(2_000_000_000).nullable().optional(),
  corporateNumber: z.string().regex(/^\d{13}$/).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  application: z.record(z.string(), z.string().max(2000)).optional(),
  // 支え手の団体として申し込むときは「支える人と団体の決まり」への同意が要る
  acceptSupporterTerms: z.boolean().optional(),
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
      vetting_status: 'APPLIED',
      applied_at: now,
      region_country: input.country,
      prefecture: input.regionCode ?? null,
      population: input.population ?? null,
      corporate_number: input.corporateNumber ?? null,
      contact_email: input.contactEmail ?? null,
      application: { purpose: input.purpose, ...(input.application ?? {}) },
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
