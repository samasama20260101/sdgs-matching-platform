// お知らせの公開側読み取り(サーバー専用)。公開 API と記事ページの両方から使う。
import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/server'
import { NEWS_LIST_MAX, type NewsPost, type NewsPostPublic } from '@/lib/constants/news'

// 公開 API が返す列(本文は含めない。記事ページはサーバーで直接読む)
const PUBLIC_COLUMNS = 'id, category, title, external_url, published_at'
const FULL_COLUMNS = 'id, category, title, body, external_url, status, published_at, created_at, updated_at'

export function clampNewsLimit(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(1, Math.floor(n)), NEWS_LIST_MAX)
}

export async function getPublishedNews(limit: number): Promise<NewsPostPublic[]> {
  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .select(PUBLIC_COLUMNS)
    .eq('status', 'PUBLISHED')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(clampNewsLimit(limit, NEWS_LIST_MAX))
  if (error) {
    console.error('[news] list error:', error)
    return []
  }
  return (data ?? []) as NewsPostPublic[]
}

export async function getPublishedNewsById(id: string): Promise<NewsPost | null> {
  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .select(FULL_COLUMNS)
    .eq('id', id)
    .eq('status', 'PUBLISHED')
    .maybeSingle()
  if (error) {
    console.error('[news] get error:', error)
    return null
  }
  return (data as NewsPost | null) ?? null
}
