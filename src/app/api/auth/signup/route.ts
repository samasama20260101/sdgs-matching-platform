// src/app/api/auth/signup/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { auth_user_id, email, real_name, display_name, phone, gender, birth_date } = await request.json()

    if (!auth_user_id || !email || !real_name) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // display_id を採番（DBのシーケンス関数を使用・競合なし）
    const { data: displayIdRow, error: seqError } = await supabaseAdmin
      .rpc('generate_display_id', { p_role: 'SOS' })
    if (seqError) {
      console.error('[api/auth/signup] generate_display_id error:', seqError)
      return NextResponse.json({ error: 'ID採番に失敗しました' }, { status: 500 })
    }

    const { error } = await supabaseAdmin.from('users').insert({
      auth_user_id,
      role: 'SOS',
      real_name,
      display_name: display_name || real_name,
      display_id: displayIdRow,
      email,
      phone: phone || null,
      gender: gender || null,
      birth_date: birth_date || null,
    })

    if (error) {
      console.error('[api/auth/signup] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/auth/signup] unexpected error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
