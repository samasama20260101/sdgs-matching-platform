import 'server-only'

import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

type AppRole = 'SOS' | 'SUPPORTER' | 'ADMIN'

export type ActiveAppUser = {
  id: string
  auth_user_id: string
  role: AppRole
  is_suspended: boolean | null
}

type RequireActiveUserOptions = {
  roles?: AppRole[]
}

type AuthSuccess = {
  token: string
  authUser: User
  appUser: ActiveAppUser
}

type AuthFailure = {
  response: NextResponse
}

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}

export async function requireActiveAppUser(
  request: Request,
  options: RequireActiveUserOptions = {}
): Promise<AuthSuccess | AuthFailure> {
  const token = getBearerToken(request)
  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }
  }

  const { data: appUser, error: appUserError } = await supabaseAdmin
    .from('users')
    .select('id, auth_user_id, role, is_suspended')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (appUserError) {
    console.error('[auth] app user fetch error:', appUserError)
    return { response: NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 }) }
  }

  if (!appUser) {
    return { response: NextResponse.json({ error: 'User profile not found' }, { status: 404 }) }
  }

  if (appUser.is_suspended) {
    return { response: NextResponse.json({ error: 'Account suspended' }, { status: 403 }) }
  }

  if (options.roles && !options.roles.includes(appUser.role as AppRole)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return {
    token,
    authUser: user,
    appUser: appUser as ActiveAppUser,
  }
}
