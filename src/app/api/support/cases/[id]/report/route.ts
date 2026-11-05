// 支える｜解決を報告する(中心の支え手だけ)。相談した人が確定するか、14 日で自動の解決になる
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireFace } from '@/lib/server/supportAuth'
import { loadSupportCase } from '@/lib/server/supportCases'
import { postSystemMessage } from '@/lib/server/systemMessages'
import { consulteeUserIds, notifyUsers } from '@/lib/server/notifyUser'

const schema = z.object({ face: z.string() })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = schema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const auth = await requireFace(request, body.data.face)
  if ('response' in auth) return auth.response
  const loaded = await loadSupportCase(auth.rf, id).catch(() => null)
  const mine = loaded?.mine
  if (!loaded?.caseRow || !mine || mine.status !== 'ACCEPTED') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mine.accepted_order !== 1) return NextResponse.json({ error: '解決の報告は中心の支え手が行います', code: 'NOT_LEAD' }, { status: 403 })
  if (loaded.caseRow.status !== 'MATCHED') return NextResponse.json({ error: 'いまは報告できません', code: 'NOT_MATCHED' }, { status: 409 })
  const { data: updated, error } = await supabaseAdmin.from('cases').update({ supporter_resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'MATCHED').is('supporter_resolved_at', null).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  // すでに報告済みなら、知らせを重ねて出さない
  if (updated) {
    await postSystemMessage(id, auth.userId, 'resolveReported')
    after(async () => notifyUsers(await consulteeUserIds(id), 'RESOLVE_REPORTED').catch(() => undefined))
  }
  return NextResponse.json({ ok: true })
}
