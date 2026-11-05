// わたし(v2.0)。GET: ログイン中の人の情報と顔 / POST: はじめの質問 / PATCH: 呼び名・年齢・地域・言語の変更
// 相談する人について持つのは、呼び名・年齢(基準日つき)・国と地域・言語だけ。メールは Auth の中にだけ置く
import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { loadFaces } from '@/lib/faces'
import { currentAge, isMinorAge, todayInTokyo } from '@/lib/domain/age'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  onboardingSchema,
  profileUpdateSchema,
} from '@/lib/validation/person'
import type { MeResponse } from '@/lib/client/meTypes'
import { recordConsents } from '@/lib/server/consents'

const USER_COLUMNS = 'id, display_id, role, display_name, age_years, age_base_date, region_country, region_code, city, locale, is_suspended'

type UserRow = {
  id: string
  display_id: string | null
  role: string
  display_name: string
  age_years: number | null
  age_base_date: string | null
  region_country: string | null
  region_code: string | null
  city: string | null
  locale: string
  is_suspended: boolean | null
}

function serverError(where: string, error: unknown) {
  console.error(`[api/me] ${where}:`, error)
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

async function consentsUpToDate(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_consents')
    .select('document, version')
    .eq('user_id', userId)
    .in('document', ['TERMS', 'PRIVACY'])
  if (error) throw error
  const has = (doc: string, version: string) => (data ?? []).some((r) => r.document === doc && r.version === version)
  return has('TERMS', CURRENT_TERMS_VERSION) && has('PRIVACY', CURRENT_PRIVACY_VERSION)
}


export async function GET(request: Request) {
  const auth = await requireAuthUser(request)
  if ('response' in auth) return auth.response

  const { data: row, error } = await supabaseAdmin
    .from('users')
    .select(USER_COLUMNS)
    .eq('auth_user_id', auth.authUser.id)
    .maybeSingle<UserRow>()
  if (error) return serverError('user fetch', error)

  const email = auth.authUser.email ?? null
  if (!row) return NextResponse.json({ onboarded: false, email } satisfies MeResponse)
  if (row.is_suspended) return NextResponse.json({ error: 'Account suspended', code: 'SUSPENDED' }, { status: 403 })

  try {
    const role = row.role === 'ADMIN' ? 'ADMIN' : 'PERSON'
    const age = currentAge(row.age_years, row.age_base_date, todayInTokyo())
    const faces = role === 'ADMIN' ? { organizations: [], individual: null } : await loadFaces(row.id)
    const factors = auth.authUser.factors ?? []
    const body: MeResponse = {
      onboarded: true,
      email,
      person: {
        id: row.id,
        displayId: row.display_id,
        role,
        displayName: row.display_name,
        age,
        isMinor: isMinorAge(age),
        country: row.region_country ?? 'JP',
        regionCode: row.region_code,
        city: row.city,
        locale: row.locale,
      },
      consentsUpToDate: await consentsUpToDate(row.id),
      faces: {
        organizations: faces.organizations.map(({ organizationId, organizationName, orgType, vettingStatus, role: r, isCoordinator }) => ({
          organizationId, organizationName, orgType, vettingStatus, role: r, isCoordinator,
        })),
        individual: faces.individual
          ? { realName: faces.individual.realName, phoneVerified: faces.individual.phoneVerified, status: faces.individual.status }
          : null,
      },
      mfa: { enrolled: factors.some((f) => f.status === 'verified'), verified: auth.aal === 'aal2' },
      loginMethods: (auth.authUser.identities ?? []).map((i) => i.provider),
    }
    return NextResponse.json(body)
  } catch (e) {
    return serverError('faces', e)
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthUser(request)
  if ('response' in auth) return auth.response

  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const input = parsed.data

  const { data: existing, error: findError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_user_id', auth.authUser.id)
    .maybeSingle()
  if (findError) return serverError('find', findError)

  let userId = existing?.id as string | undefined
  if (!userId) {
    const { data: created, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: auth.authUser.id,
        role: 'PERSON',
        display_name: input.displayName,
        age_years: input.age,
        age_base_date: todayInTokyo(),
        region_country: input.country,
        region_code: input.regionCode ?? null,
        city: input.city || null,
        locale: input.locale,
        onboarded_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insertError) {
      // 同じ人が2つの画面から同時に送ったとき(auth_user_id の一意索引)
      if (insertError.code === '23505') {
        const { data: again } = await supabaseAdmin.from('users').select('id').eq('auth_user_id', auth.authUser.id).maybeSingle()
        userId = again?.id as string | undefined
      }
      if (!userId) return serverError('insert', insertError)
    } else {
      userId = created.id as string
    }
  }

  try {
    await recordConsents(userId)
  } catch (e) {
    return serverError('consents', e)
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const auth = await requireAuthUser(request)
  if ('response' in auth) return auth.response

  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const input = parsed.data

  const update: Record<string, unknown> = {}
  if (input.displayName !== undefined) update.display_name = input.displayName
  // 本人が年齢を直したら、その日を新しい基準日にする(11/5 定例)
  if (input.age !== undefined) {
    update.age_years = input.age
    update.age_base_date = todayInTokyo()
  }
  if (input.country !== undefined) {
    update.region_country = input.country
    if (input.regionCode === undefined) update.region_code = null
  }
  if (input.regionCode !== undefined) update.region_code = input.regionCode
  if (input.city !== undefined) update.city = input.city || null
  if (input.locale !== undefined) update.locale = input.locale

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(update)
    .eq('auth_user_id', auth.authUser.id)
    .or('is_suspended.is.null,is_suspended.eq.false')
    .select('id')
    .maybeSingle()
  if (error) return serverError('update', error)
  if (!data) return NextResponse.json({ error: 'User profile not found', code: 'ONBOARDING_REQUIRED' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
