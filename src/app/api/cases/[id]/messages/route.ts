// やりとり(相談する側と、選ばれた支え手)。GET ?lang=xx で、その言語の訳があれば一緒に返す
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { isThreadOpen, listThread, MESSAGE_MAX, postUserMessage } from '@/lib/server/messages'
import { locales } from '@/i18n/routing'

const schema = z.object({ content: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(MESSAGE_MAX)) })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const lang = new URL(request.url).searchParams.get('lang')
  try {
    const access = await resolveCaseAccess(auth.appUser.id, id)
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const messages = await listThread(access, auth.appUser.id, lang && (locales as readonly string[]).includes(lang) ? lang : null)
    return NextResponse.json({ messages, open: isThreadOpen(access.caseRow.status), role: access.role })
  } catch (e) {
    console.error('[api/cases/messages]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: `1〜${MESSAGE_MAX}文字で書いてください`, code: 'INVALID' }, { status: 400 })
  try {
    const access = await resolveCaseAccess(auth.appUser.id, id)
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // やりとりは、支え手を選んで「一緒に進める」ようになってから(受付中は申し出のメッセージだけ)
    if (access.caseRow.status !== 'MATCHED') return NextResponse.json({ error: 'いまはメッセージを送れません', code: 'NOT_MATCHED' }, { status: 409 })
    const messageId = await postUserMessage(access, auth.appUser.id, parsed.data.content)
    return NextResponse.json({ id: messageId })
  } catch (e) {
    console.error('[api/cases/messages] post', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
