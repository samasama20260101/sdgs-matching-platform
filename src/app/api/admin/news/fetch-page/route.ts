// src/app/api/admin/news/fetch-page/route.ts
// 管理者: 参加団体・インタビューの AI 下書き用に、URL のページから本文テキストを読み取る(最大 3 ページ)。DB には書かない。
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { NEWS_SOURCE_URLS_MAX } from '@/lib/constants/news'
import { fetchPageText } from '@/lib/news/pageText'

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  let body: { urls?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }
  const urls = Array.isArray(body.urls)
    ? [...new Set(body.urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '').map((u) => u.trim()))]
    : []
  if (urls.length === 0) return NextResponse.json({ error: 'URL を入力してください' }, { status: 400 })
  if (urls.length > NEWS_SOURCE_URLS_MAX) return NextResponse.json({ error: `URL は ${NEWS_SOURCE_URLS_MAX} つまでです` }, { status: 400 })

  const pages = await Promise.all(urls.map((url) => fetchPageText(url)))
  return NextResponse.json({ pages })
}
