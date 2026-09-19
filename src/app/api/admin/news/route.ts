// src/app/api/admin/news/route.ts
// 管理者: お知らせの一覧(下書き含む)・新規作成
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { NOTE_ARTICLE_WORKFLOW_ENABLED, type NewsPostAdmin } from '@/lib/constants/news'
import { parseNewsInput } from '@/lib/news/adminInput'

// 列名を string にすると supabase-js の select 型推論(文字列パーサ)を通らないので、返り型は returns<>() で明示する
const ADMIN_NEWS_COLUMNS: string = NOTE_ARTICLE_WORKFLOW_ENABLED
    ? 'id, category, title, body, external_url, status, published_at, interview_source, note_angle, note_article, note_checklist, created_at, updated_at'
    : 'id, category, title, body, external_url, status, published_at, created_at, updated_at'

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .select(ADMIN_NEWS_COLUMNS)
    .order('published_at', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false })
    .returns<NewsPostAdmin[]>()
  if (error) {
    console.error('[admin/news] list error:', error)
    return NextResponse.json({ error: 'お知らせの取得に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }
  const parsed = parseNewsInput(raw)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .insert({ ...parsed.data, created_by: auth.appUser.id })
    .select(ADMIN_NEWS_COLUMNS)
    .returns<NewsPostAdmin[]>()
    .single()
  if (error || !data) {
    console.error('[admin/news] insert error:', error)
    return NextResponse.json({ error: 'お知らせの保存に失敗しました' }, { status: 500 })
  }

  if (data.status === 'PUBLISHED') {
    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: auth.appUser.id,
      action: 'news_post_published',
      target_table: 'news_posts',
      target_id: data.id,
      metadata: { title: data.title, category: data.category },
    })
  }
  return NextResponse.json({ post: data })
}
