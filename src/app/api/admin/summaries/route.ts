// 運営｜解決した相談の要約(ナレッジ。11/5)。よい取り組みはモデルケースの印を付ける
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const { data, error } = await supabaseAdmin
    .from('case_summaries')
    .select('case_id, content, actions, aftermath, source, is_model_case, created_at, cases(display_id, subject_type)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  return NextResponse.json({ summaries: data ?? [] })
}

const patchSchema = z.object({ caseId: z.string().uuid(), isModelCase: z.boolean() })

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const { error } = await supabaseAdmin.from('case_summaries').update({ is_model_case: parsed.data.isModelCase, reviewed_by_user_id: auth.appUser.id, reviewed_at: new Date().toISOString() }).eq('case_id', parsed.data.caseId)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
