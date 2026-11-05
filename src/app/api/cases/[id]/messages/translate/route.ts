// やりとりの訳(本人が「訳を見る」を押したときだけ)。原文は残し、訳を message_translations に足す。
// 外の AI に送る前に maskPii で伏せ、fenceConsultation で囲む(11/5 定例。プライバシーポリシーに書く)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { generateJson, isAiConfigured } from '@/lib/ai/client'
import { buildTranslatePrompt, parseTranslations } from '@/lib/ai/prompts/translate'
import { fenceConsultation } from '@/lib/aiSafety'
import { maskPii } from '@/lib/pii'
import { locales } from '@/i18n/routing'

const MAX_PER_REQUEST = 20
const CONCURRENCY = 4
const schema = z.object({ lang: z.enum(locales) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: '入力を確かめてください', code: 'INVALID' }, { status: 400 })
  const lang = parsed.data.lang
  if (!isAiConfigured('translation')) return NextResponse.json({ error: '訳はいま使えません', code: 'NOT_CONFIGURED' }, { status: 503 })

  const access = await resolveCaseAccess(auth.appUser.id, id, auth.aal).catch(() => null)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rows, error } = await supabaseAdmin
    .from('messages')
    .select('id, content, original_language')
    .eq('case_id', id)
    .eq('message_type', 'USER')
    // v1 のメッセージは言語の印がないので、それも訳す対象にする
    .or(`original_language.is.null,original_language.neq.${lang}`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  const ids = (rows ?? []).map((r) => r.id as string)
  if (ids.length === 0) return NextResponse.json({ translated: 0 })
  const { data: done } = await supabaseAdmin.from('message_translations').select('message_id').eq('language', lang).in('message_id', ids)
  const doneIds = new Set((done ?? []).map((d) => d.message_id as string))
  const todo = (rows ?? []).filter((r) => !doneIds.has(r.id as string)).slice(0, MAX_PER_REQUEST)
  if (todo.length === 0) return NextResponse.json({ translated: 0 })

  // 1 つの文ごとに頼む(ほかの人の文の訳に指示が混ざらないように)。同時に頼むのは数件ずつ
  const rowsOut: { message_id: string; language: string; content: string; provider: string; model: string }[] = []
  let failed: string | null = null
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(async (row) => {
      const messageId = row.id as string
      const prompt = buildTranslatePrompt(lang, [{ id: messageId, fenced: fenceConsultation(maskPii(row.content as string)) }])
      const result = await generateJson('translation', prompt, { temperature: 0.2 })
      if (!result.ok) return { messageId, error: result.code as string }
      const text = parseTranslations(result.json, new Set([messageId])).get(messageId)
      return text ? { messageId, text, provider: result.provider, model: result.model } : { messageId, error: 'INVALID_JSON' }
    }))
    for (const r of results) {
      if ('text' in r && r.text) rowsOut.push({ message_id: r.messageId, language: lang, content: r.text, provider: r.provider, model: r.model })
      else if ('error' in r) failed = r.error ?? 'REQUEST_FAILED'
    }
  }
  if (rowsOut.length > 0) {
    await supabaseAdmin.from('message_translations').upsert(rowsOut, { onConflict: 'message_id,language', ignoreDuplicates: true })
  }
  if (rowsOut.length === 0 && failed) return NextResponse.json({ error: '訳せませんでした', code: failed }, { status: 502 })
  return NextResponse.json({ translated: rowsOut.length })
}
