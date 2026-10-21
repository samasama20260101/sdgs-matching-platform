// src/app/api/admin/news/draft/route.ts
// 管理者: お知らせの AI 下書き生成。DB には書かない(結果はフォームに入れて人が直す)。
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isNewsCategory, NEWS_MATERIAL_MAX, NEWS_PAGE_TEXT_MAX } from '@/lib/constants/news'
import { generateNewsDraft } from '@/lib/newsDraft'

function pickText(value: unknown, max = NEWS_MATERIAL_MAX) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  let body: { category?: unknown; materials?: { site?: unknown; memo?: unknown; notes?: unknown; pageText?: unknown } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  if (!isNewsCategory(body.category)) {
    return NextResponse.json({ error: '種別が不正です' }, { status: 400 })
  }
  const materials = {
    site: pickText(body.materials?.site),
    memo: pickText(body.materials?.memo),
    notes: pickText(body.materials?.notes),
    pageText: pickText(body.materials?.pageText, NEWS_PAGE_TEXT_MAX),
  }

  const result = await generateNewsDraft(body.category, materials)
  if (result.ok) return NextResponse.json({ draft: result.draft })

  if (result.code === 'EMPTY_MATERIALS') {
    return NextResponse.json({ error: '材料を入力してください', code: result.code }, { status: 400 })
  }
  if (result.code === 'NO_API_KEY') {
    return NextResponse.json({ error: 'AI下書きは使えません(APIキー未設定)。手で書けます', code: result.code }, { status: 503 })
  }
  return NextResponse.json({ error: '下書きを作れませんでした。もう一度試すか、手で書いてください', code: result.code }, { status: 502 })
}
