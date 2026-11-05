// やりとり(相談する側と、選ばれた支え手)。GET ?lang=xx で、その言語の訳があれば一緒に返す。
// ?after=<日時> を付けると、その時刻より後のものだけを返す(画面の 20 秒ごとの読み直し)
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { resolveCaseAccess } from '@/lib/server/caseAccess'
import { isThreadOpen, listThread, MESSAGE_MAX, postUserMessage } from '@/lib/server/messages'
import { locales } from '@/i18n/routing'
import { chosenSupporterUserIds, consulteeUserIds, notifyUsers } from '@/lib/server/notifyUser'
import { parseThreadAfter } from '@/lib/domain/thread'

const schema = z.object({ content: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(MESSAGE_MAX)) })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const search = new URL(request.url).searchParams
  const lang = search.get('lang')
  const after = parseThreadAfter(search.get('after'))
  try {
    const access = await resolveCaseAccess(auth.appUser.id, id, auth.aal)
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const messages = await listThread(access, auth.appUser.id, lang && (locales as readonly string[]).includes(lang) ? lang : null, after)
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
    const access = await resolveCaseAccess(auth.appUser.id, id, auth.aal)
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // やりとりは、支え手を選んで「一緒に進める」ようになってから(受付中は申し出のメッセージだけ)
    if (access.caseRow.status !== 'MATCHED') return NextResponse.json({ error: 'いまはメッセージを送れません', code: 'NOT_MATCHED' }, { status: 409 })
    const messageId = await postUserMessage(access, auth.appUser.id, parsed.data.content)
    const sender = auth.appUser.id
    after(async () => {
      const to = access.role === 'CONSULTEE' ? await chosenSupporterUserIds(id) : await consulteeUserIds(id)
      await notifyUsers(to.filter((u) => u !== sender), 'NEW_MESSAGE').catch(() => undefined)
    })
    return NextResponse.json({ id: messageId })
  } catch (e) {
    console.error('[api/cases/messages] post', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
