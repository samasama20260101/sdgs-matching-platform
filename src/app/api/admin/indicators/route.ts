// 運営｜指標の仕分け(盤 51)。本人が選んだ指標・AI の候補を確定するか外す。運営が足すこともできる。
// 確定した指標だけが社会貢献の記録と地図に数えられる。解決済みの相談なら記録を付け直す(record_case_resolution)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { optionsFor, type SubjectType } from '@/lib/domain/intake'

const decideSchema = z.object({
  caseId: z.string().uuid(),
  code: z.string().regex(/^\d{1,2}\.[0-9a-z]{1,2}\.\d{1,2}$/),
  decision: z.enum(['CONFIRM', 'REJECT', 'ADD']),
})

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const { data: proposed, error } = await supabaseAdmin
    .from('case_indicators')
    .select('case_id, indicator_code, source, status, confidence, reason, created_at')
    .eq('status', 'PROPOSED')
    .order('created_at', { ascending: true })
    .limit(300)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const caseIds = [...new Set((proposed ?? []).map((p) => p.case_id as string))].slice(0, 50)
  if (caseIds.length === 0) return NextResponse.json({ cases: [] })
  const [{ data: cases }, { data: confirmed }] = await Promise.all([
    supabaseAdmin.from('cases').select('id, display_id, title, status, subject_type, ai_sdg_suggestion, description_free').in('id', caseIds),
    supabaseAdmin.from('case_indicators').select('case_id, indicator_code, source').in('case_id', caseIds).eq('status', 'CONFIRMED'),
  ])
  const text = (subject: string, code: string) => optionsFor(subject as SubjectType).find((o) => o.id === code)?.text ?? code
  return NextResponse.json({
    cases: (cases ?? []).map((c) => ({
      id: c.id,
      displayId: c.display_id,
      title: c.title,
      status: c.status,
      subjectType: c.subject_type,
      summary: (c.ai_sdg_suggestion as { summary?: string } | null)?.summary ?? (c.description_free as string).slice(0, 200),
      proposed: (proposed ?? []).filter((p) => p.case_id === c.id).map((p) => ({ code: p.indicator_code, text: text(c.subject_type as string, p.indicator_code as string), source: p.source, confidence: p.confidence, reason: p.reason })),
      confirmed: (confirmed ?? []).filter((p) => p.case_id === c.id).map((p) => ({ code: p.indicator_code, text: text(c.subject_type as string, p.indicator_code as string) })),
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  const parsed = decideSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const { caseId, code, decision } = parsed.data
  const now = new Date().toISOString()
  if (decision === 'ADD') {
    const { error } = await supabaseAdmin.from('case_indicators').upsert(
      { case_id: caseId, indicator_code: code, source: 'ADMIN', status: 'CONFIRMED', decided_by_user_id: auth.appUser.id, decided_at: now },
      { onConflict: 'case_id,indicator_code,source' },
    )
    if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  } else {
    // 同じ番号の候補(本人・AI)をまとめて決める
    const { error } = await supabaseAdmin
      .from('case_indicators')
      .update({ status: decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED', decided_by_user_id: auth.appUser.id, decided_at: now })
      .eq('case_id', caseId)
      .eq('indicator_code', code)
      .eq('status', 'PROPOSED')
    if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  const { data: c } = await supabaseAdmin.from('cases').select('status').eq('id', caseId).maybeSingle()
  if (c?.status === 'RESOLVED') {
    const { error } = await supabaseAdmin.rpc('record_case_resolution', { p_case_id: caseId })
    if (error) console.error('[admin/indicators] record', error)
  }
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, action: 'admin.indicator_decide', target_table: 'cases', target_id: caseId, metadata: { code, decision } })
  return NextResponse.json({ ok: true })
}
