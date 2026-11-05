import 'server-only'

import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// v2.0: 1人1アカウント。ロールは「人」(相談する・支える)と「運営」の2つだけ。
// 支える側の顔(団体の一員・個人の支え手)はロールでなく所属と支え手の登録で決まる(src/lib/faces.ts)。
export type AppRole = 'PERSON' | 'ADMIN'

export type ActiveAppUser = {
  id: string
  auth_user_id: string
  role: AppRole
  is_suspended: boolean | null
  locale: string
}

type RequireActiveUserOptions = {
  roles?: AppRole[]
  // 2つ目の確認(認証アプリのコード)まで済んだログインだけを通す。運営の API は必ず付ける
  requireMfa?: boolean
}

type AuthSuccess = {
  token: string
  authUser: User
  appUser: ActiveAppUser
  aal: 'aal1' | 'aal2'
}

type AuthFailure = {
  response: NextResponse
}

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}

// トークンの中の aal(2つ目の確認を済ませたか)。署名は呼び出し側で supabaseAdmin.auth.getUser により確かめたあとに読む
export function readTokenAal(token: string): 'aal1' | 'aal2' {
  try {
    const payload = token.split('.')[1]
    if (!payload) return 'aal1'
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as { aal?: unknown }
    return json.aal === 'aal2' ? 'aal2' : 'aal1'
  } catch {
    return 'aal1'
  }
}

function json(status: number, error: string, code?: string) {
  return { response: NextResponse.json(code ? { error, code } : { error }, { status }) }
}

// ログインしているか(users の行がまだなくてもよい)。はじめの質問の前に使う
export async function requireAuthUser(request: Request): Promise<{ token: string; authUser: User; aal: 'aal1' | 'aal2' } | AuthFailure> {
  const token = getBearerToken(request)
  if (!token) return json(401, 'Unauthorized')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return json(401, 'Invalid token')
  return { token, authUser: user, aal: readTokenAal(token) }
}

export async function requireActiveAppUser(
  request: Request,
  options: RequireActiveUserOptions = {}
): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuthUser(request)
  if ('response' in auth) return auth

  const { data: appUser, error: appUserError } = await supabaseAdmin
    .from('users')
    .select('id, auth_user_id, role, is_suspended, locale')
    .eq('auth_user_id', auth.authUser.id)
    .maybeSingle()

  if (appUserError) {
    console.error('[auth] app user fetch error:', appUserError)
    return json(500, 'サーバーエラーが発生しました')
  }
  // はじめの質問がまだ(画面は /start へ案内する)
  if (!appUser) return json(404, 'User profile not found', 'ONBOARDING_REQUIRED')
  if (appUser.is_suspended) return json(403, 'Account suspended', 'SUSPENDED')

  const role = appUser.role === 'ADMIN' ? 'ADMIN' : appUser.role === 'PERSON' ? 'PERSON' : null
  if (!role) return json(403, 'Forbidden')
  if (options.roles && !options.roles.includes(role)) return json(403, 'Forbidden')
  if (options.requireMfa && auth.aal !== 'aal2') return json(403, 'MFA required', 'MFA_REQUIRED')

  return {
    token: auth.token,
    authUser: auth.authUser,
    appUser: { id: appUser.id, auth_user_id: appUser.auth_user_id, role, is_suspended: appUser.is_suspended, locale: appUser.locale },
    aal: auth.aal,
  }
}

// 運営の API の入口。2つ目の確認まで済んだログインだけを通す(HANDOFF の申し送り 1)
export function requireAdmin(request: Request) {
  return requireActiveAppUser(request, { roles: ['ADMIN'], requireMfa: true })
}
