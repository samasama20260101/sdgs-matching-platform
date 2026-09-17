// src/app/api/public/news/route.ts
// 公開: お知らせ一覧(公開中のみ・新しい順)。トップページの「お知らせ」ブロックが使う。
import { NextResponse } from 'next/server'
import { NEWS_TOP_LIMIT } from '@/lib/constants/news'
import { clampNewsLimit, getPublishedNews } from '@/lib/news/queries'

export async function GET(request: Request) {
  const limit = clampNewsLimit(new URL(request.url).searchParams.get('limit') ?? NEWS_TOP_LIMIT, NEWS_TOP_LIMIT)
  const posts = await getPublishedNews(limit)
  return NextResponse.json(
    { posts },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } }
  )
}
