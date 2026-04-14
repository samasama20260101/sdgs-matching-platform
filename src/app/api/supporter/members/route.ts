// src/app/api/supporter/members/route.ts
// サブアカウント（メンバー）管理API
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MAX_MEMBERS = 5

// ── 認証・親アカウント取得ヘルパー ──
async function getParentUser(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, role, parent_supporter_id')
    .eq('auth_user_id', user.id)
    .single()
  if (userError) {
    console.error('[members] getParentUser error:', JSON.stringify(userError))
    return null
  }
  // 親アカウント（role=SUPPORTER かつ parent_supporter_id=null）のみ操作可
  if (!userData || userData.role !== 'SUPPORTER' || userData.parent_supporter_id !== null) return null
  return userData
}

// GET: メンバー一覧取得
export async function GET(request: Request) {
  const parent = await getParentUser(request)
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: members } = await supabaseAdmin
    .from('users')
    .select('id, real_name, display_name, email, display_id, member_approved_at, created_at')
    .eq('parent_supporter_id', parent.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ members: members ?? [], max: MAX_MEMBERS })
}

// POST: メンバー追加（メールアドレスで既存ユーザーを招待 or 新規作成）
export async function POST(request: Request) {
  const parent = await getParentUser(request)
  if (!parent) return NextResponse.json({ error: 'Unauthorized または parent_supporter_id カラムが未追加の可能性があります。Supabase で ALTER TABLE を実行してください。' }, { status: 401 })
  const { count } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('parent_supporter_id', parent.id)
  if ((count ?? 0) >= MAX_MEMBERS) {
    return NextResponse.json({ error: `メンバーは最大${MAX_MEMBERS}名までです` }, { status: 400 })
  }

  const { email, real_name, password } = await request.json()
  if (!email || !real_name || !password) {
    return NextResponse.json({ error: 'メールアドレス・氏名・パスワードは必須です' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 })
  }

  // すでにアプリのユーザーとして存在するか確認
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, role, parent_supporter_id')
    .eq('email', email)
    .single()

  if (existing) {
    // 他の団体のメンバーや管理者は追加不可
    if (existing.role !== 'SUPPORTER') {
      return NextResponse.json({ error: 'このメールアドレスは別のロールで登録されています' }, { status: 400 })
    }
    if (existing.parent_supporter_id && existing.parent_supporter_id !== parent.id) {
      return NextResponse.json({ error: 'このユーザーはすでに別の団体のメンバーです' }, { status: 400 })
    }
    // すでに自分の団体のメンバー
    if (existing.parent_supporter_id === parent.id) {
      return NextResponse.json({ error: 'このユーザーはすでにメンバーです' }, { status: 400 })
    }
    // 既存のサポーターアカウントをサブに紐付け
    await supabaseAdmin.from('users').update({
      parent_supporter_id: parent.id,
      member_approved_at: new Date().toISOString(),
    }).eq('id', existing.id)
    const { data: updated } = await supabaseAdmin.from('users').select('id, real_name, display_name, email, display_id, member_approved_at, created_at').eq('id', existing.id).single()
    return NextResponse.json({ member: updated })
  }

  // 新規: Supabase Auth にユーザーを作成（親が設定したパスワード）
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? '認証ユーザーの作成に失敗しました' }, { status: 500 })
  }

  // display_id 採番
  const { data: displayIdRow } = await supabaseAdmin.rpc('generate_display_id', { p_role: 'SUPPORTER' })

  // public.users に挿入
  const { data: newUser, error: insertError } = await supabaseAdmin.from('users').insert({
    auth_user_id: authData.user.id,
    role: 'SUPPORTER',
    display_id: displayIdRow,
    email,
    real_name,
    display_name: real_name,
    parent_supporter_id: parent.id,
    member_approved_at: new Date().toISOString(),
    must_change_password: true,
  }).select('id, real_name, display_name, email, display_id, member_approved_at, created_at').single()

  if (insertError) {
    // ロールバック: auth ユーザーを削除
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ member: newUser })
}

// DELETE: メンバー削除
export async function DELETE(request: Request) {
  const parent = await getParentUser(request)
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

  // 自分の子であることを確認
  const { data: member } = await supabaseAdmin
    .from('users')
    .select('id, auth_user_id, parent_supporter_id')
    .eq('id', memberId)
    .single()

  if (!member || member.parent_supporter_id !== parent.id) {
    return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  }

  // parent_supporter_id を null に戻す（アカウント自体は残す）
  await supabaseAdmin.from('users').update({
    parent_supporter_id: null,
    member_approved_at: null,
  }).eq('id', memberId)

  return NextResponse.json({ success: true })
}
