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

  const access = await resolveCaseAccess(auth.appUser.id, id).catch(() => null)
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

  const prompt = buildTranslatePrompt(lang, todo.map((r) => ({ id: r.id as string, fenced: fenceConsultation(maskPii(r.content as string)) })))
  const result = await generateJson('translation', prompt, { temperature: 0.2 })
  if (!result.ok) return NextResponse.json({ error: '訳せませんでした', code: result.code }, { status: 502 })
  const map = parseTranslations(result.json, new Set(todo.map((r) => r.id as string)))
  if (map.size > 0) {
    await supabaseAdmin.from('message_translations').upsert(
      [...map].map(([messageId, content]) => ({ message_id: messageId, language: lang, content, provider: result.provider, model: result.model })),
      { onConflict: 'message_id,language', ignoreDuplicates: true },
    )
  }
  return NextResponse.json({ translated: map.size })
}
