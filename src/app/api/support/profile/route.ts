// 支え手になる(個人。盤 21)。本名・得意なこと(会社・地域の相談ごとの大項目。src/lib/domain/supportAreas.ts)・地域・遠隔で可・言語。「支える人と団体の決まり」への同意を残す。
// 本名は申し出た相談の相手と、手を挙げた団体にだけ見せる。相談する側では使わない(決めてほしいこと 10)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { recordSupporterConsent } from '@/lib/server/consents'
import { canSupportNow } from '@/lib/faces'
import { underSupporterAgeResponse } from '@/lib/server/supportAuth'
import { isCountryCode } from '@/lib/constants/countries'
import { locales } from '@/i18n/routing'
import { areaSubjectsForFace, sanitizeSkillAreas } from '@/lib/domain/supportAreas'

const schema = z.object({
  realName: z.string().transform((v) => v.normalize('NFKC').replace(/\s+/g, ' ').trim()).pipe(z.string().min(1).max(100)),
  // "COMPANY:1" の形。知らない組み合わせと個人の相談の分は捨てる
  skillAreas: z.array(z.string().max(20)).max(64),
  country: z.string().refine(isCountryCode),
  regionCode: z.string().regex(/^[A-Z]{2}-[0-9A-Z]{1,3}$/).nullable().optional(),
  remoteOk: z.boolean(),
  languages: z.array(z.enum(locales)).min(1),
  intro: z.string().max(500).optional(),
  acceptSupporterTerms: z.literal(true),
})

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const { data, error } = await supabaseAdmin.from('supporter_profiles').select('real_name, skill_areas, region_country, region_code, remote_ok, languages, intro, phone_verified_at, status').eq('user_id', auth.appUser.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  return NextResponse.json({ profile: data })
}

export async function PUT(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const p = parsed.data
  if (!(await canSupportNow(auth.appUser.id))) return underSupporterAgeResponse()
  const { error } = await supabaseAdmin.from('supporter_profiles').upsert({
    user_id: auth.appUser.id,
    real_name: p.realName,
    skill_areas: sanitizeSkillAreas(p.skillAreas, areaSubjectsForFace('INDIVIDUAL')),
    region_country: p.country,
    region_code: p.regionCode ?? null,
    remote_ok: p.remoteOk,
    languages: [...new Set(p.languages)],
    intro: p.intro?.trim() || null,
  }, { onConflict: 'user_id' })
  if (error) {
    console.error('[api/support/profile]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  try {
    await recordSupporterConsent(auth.appUser.id)
  } catch (e) {
    console.error('[api/support/profile] consent', e)
  }
  return NextResponse.json({ ok: true })
}
