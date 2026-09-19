// src/app/api/admin/news/article/route.ts
// 管理者: note 記事ワークフロー(切り口3案 / 本文 / 見直し)。DB には書かない(保存は PATCH /api/admin/news/[id])。
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isNewsAngle, NEWS_ARTICLE_MAX, NEWS_INTERVIEW_SOURCE_MAX, NOTE_ARTICLE_WORKFLOW_ENABLED } from '@/lib/constants/news'
import { proposeArticleAngles, reviewNoteArticle, writeNoteArticle, type ArticleFailure } from '@/lib/newsArticle'

function pickText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function failure(result: ArticleFailure) {
  if (result.code === 'EMPTY_INPUT') return NextResponse.json({ error: '取材メモを入力してください', code: result.code }, { status: 400 })
  if (result.code === 'NO_API_KEY') return NextResponse.json({ error: 'AI は使えません(APIキー未設定)。手で書けます', code: result.code }, { status: 503 })
  return NextResponse.json({ error: '生成に失敗しました。もう一度試すか、手で書いてください', code: result.code }, { status: 502 })
}

export async function POST(request: Request) {
  if (!NOTE_ARTICLE_WORKFLOW_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  let body: { step?: unknown; source?: unknown; angle?: unknown; article?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const source = pickText(body.source, NEWS_INTERVIEW_SOURCE_MAX)
  if (!source) return NextResponse.json({ error: '取材メモを入力してください' }, { status: 400 })

  if (body.step === 'angles') {
    const result = await proposeArticleAngles(source)
    return result.ok ? NextResponse.json({ angles: result.angles }) : failure(result)
  }
  if (body.step === 'write') {
    if (!isNewsAngle(body.angle)) return NextResponse.json({ error: '切り口を選んでください' }, { status: 400 })
    const result = await writeNoteArticle(source, body.angle)
    return result.ok ? NextResponse.json({ title: result.title, lead: result.lead, article: result.article }) : failure(result)
  }
  if (body.step === 'review') {
    const article = pickText(body.article, NEWS_ARTICLE_MAX)
    if (!article) return NextResponse.json({ error: '記事本文がありません' }, { status: 400 })
    const result = await reviewNoteArticle(source, article)
    return result.ok ? NextResponse.json({ checklist: result.checklist }) : failure(result)
  }
  return NextResponse.json({ error: 'step が不正です' }, { status: 400 })
}
