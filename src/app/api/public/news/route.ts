// src/app/api/public/news/route.ts
// 公開: お知らせ一覧(公開中のみ・新しい順)。トップページの「お知らせ」ブロックが使う。
import { NextResponse } from 'next/server'
import { NEWS_TOP_LIMIT } from '@/lib/constants/news'
import { clampNewsLimit, getPublishedNews } from '@/lib/news/queries'

export async function GET(request: Request) {
  const limit = clampNewsLimit(new URL(request.url).searchParams.get('limit') ?? NEWS_TOP_LIMIT, NEWS_TOP_LIMIT)
  const posts = await getPublishedNews(limit)
  // CDN にキャッシュさせない。s-maxage + stale-while-revalidate だと、公開直後にトップを
  // 確認しても古い応答(公開前の空配列)が最大10分返り続けた(2026-09-17 プレビューで実測)。
  // 更新頻度が低く、トップの fetch 1回分なので featured-supporters と同じ no-store にする。
  return NextResponse.json({ posts }, { headers: { 'Cache-Control': 'no-store' } })
}
