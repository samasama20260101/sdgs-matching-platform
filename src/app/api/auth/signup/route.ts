// src/app/api/auth/signup/route.ts
import { getBearerToken } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { defaultLocale, isAppLocale } from '@/i18n/routing'
import { NextResponse } from 'next/server'

const MAX_SOS_USERS = 1000  // SOSユーザー登録上限（将来変更する場合はここだけ変える）

export async function POST(request: Request) {
  try {
    const { auth_user_id, email, real_name, display_name, phone, gender, birth_date, locale } = await request.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const userLocale = isAppLocale(locale) ? locale : defaultLocale

    if (!normalizedEmail || !real_name) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const bearerToken = getBearerToken(request)
    if (!bearerToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: { user }, error: tokenError } = await supabaseAdmin.auth.getUser(bearerToken)
    if (tokenError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    if (auth_user_id && auth_user_id !== user.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const authUserId = user.id
    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(authUserId)
    const authEmail = authUserData.user?.email?.trim().toLowerCase()
    if (authUserError || !authUserData.user || authEmail !== normalizedEmail) {
      console.error('[api/auth/signup] auth user verification failed:', authUserError)
      return NextResponse.json({ error: '認証ユーザーの確認に失敗しました' }, { status: 400 })
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    if (existingProfileError) {
      console.error('[api/auth/signup] existing profile fetch error:', existingProfileError)
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
    if (existingProfile) {
      if (existingProfile.role !== 'SOS') {
        return NextResponse.json({ error: 'この認証ユーザーはSOSユーザーとして登録できません' }, { status: 409 })
      }
      return NextResponse.json({ success: true })
    }

    // SOSユーザー登録上限チェック
    const { count, error: countError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'SOS')
    if (countError) {
      console.error('[api/auth/signup] count error:', countError)
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
    if ((count ?? 0) >= MAX_SOS_USERS) {
      return NextResponse.json(
        { error: 'REGISTRATION_CLOSED', message: '現在、新規登録の受付を一時停止しています。しばらく経ってからお試しください。' },
        { status: 503 }
      )
    }

    // display_id を採番（DBのシーケンス関数を使用・競合なし）
    const { data: displayIdRow, error: seqError } = await supabaseAdmin
      .rpc('generate_display_id', { p_role: 'SOS' })
    if (seqError) {
      console.error('[api/auth/signup] generate_display_id error:', seqError)
      return NextResponse.json({ error: 'ID採番に失敗しました' }, { status: 500 })
    }

    const { error } = await supabaseAdmin.from('users').insert({
      auth_user_id: authUserId,
      role: 'SOS',
      real_name: String(real_name).trim().slice(0, 64),
      display_name: typeof display_name === 'string' && display_name.trim()
        ? display_name.trim().slice(0, 64)
        : String(real_name).trim().slice(0, 64),
      display_id: displayIdRow,
      email: normalizedEmail,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 30) : null,
      gender: typeof gender === 'string' && ['MALE', 'FEMALE', 'OTHER'].includes(gender) ? gender : null,
      birth_date: typeof birth_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birth_date) ? birth_date : null,
      locale: userLocale,
    })

    if (error) {
      console.error('[api/auth/signup] insert error:', error)
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/auth/signup] unexpected error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
