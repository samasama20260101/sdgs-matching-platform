// 団体を登録する(v2.0)。会社・地域として相談するための登録と、支え手の団体の申し込みの入口を兼ねる。
// どちらも「申し込み」(APPLIED)から始まり、支え手として一覧に載るのは運営の面談のあと(11/5 の審査の流れ)。
// 登録した人がその団体の管理者(OWNER)になる
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { isCountryCode } from '@/lib/constants/countries'

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
})

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const input = parsed.data

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
  return NextResponse.json({ id: org.id, displayId: org.display_id })
}
