// src/app/api/admin/news/[id]/route.ts
// 管理者: お知らせの更新(公開/下書き切替を含む)・削除
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { NOTE_ARTICLE_WORKFLOW_ENABLED, type NewsPostAdmin } from '@/lib/constants/news'
import { isUuid } from '@/lib/api/validation'
import { parseNewsInput } from '@/lib/news/adminInput'

// 列名を string にすると supabase-js の select 型推論(文字列パーサ)を通らないので、返り型は returns<>() で明示する
const COLUMNS: string = NOTE_ARTICLE_WORKFLOW_ENABLED
    ? 'id, category, title, body, external_url, status, published_at, interview_source, note_angle, note_article, note_checklist, created_at, updated_at'
    : 'id, category, title, body, external_url, status, published_at, created_at, updated_at'

type Params = { params: Promise<{ id: string }> }

async function writeAudit(actorId: string, action: string, targetId: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: actorId,
    action,
    target_table: 'news_posts',
    target_id: targetId,
    metadata,
  })
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }
  const parsed = parseNewsInput(raw)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('news_posts')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) {
    console.error('[admin/news] fetch error:', fetchError)
    return NextResponse.json({ error: 'お知らせの取得に失敗しました' }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'お知らせが見つかりません' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('news_posts')
    .update(parsed.data)
    .eq('id', id)
    .select(COLUMNS)
    .returns<NewsPostAdmin[]>()
    .single()
  if (error || !data) {
    console.error('[admin/news] update error:', error)
    return NextResponse.json({ error: 'お知らせの保存に失敗しました' }, { status: 500 })
  }

  if (existing.status !== 'PUBLISHED' && data.status === 'PUBLISHED') {
    await writeAudit(auth.appUser.id, 'news_post_published', id, { title: data.title, category: data.category })
  } else if (existing.status === 'PUBLISHED' && data.status !== 'PUBLISHED') {
    await writeAudit(auth.appUser.id, 'news_post_unpublished', id, { title: data.title, category: data.category })
  }
  return NextResponse.json({ post: data })
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('news_posts')
    .select('id, title, category, status')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) {
    console.error('[admin/news] fetch error:', fetchError)
    return NextResponse.json({ error: 'お知らせの取得に失敗しました' }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'お知らせが見つかりません' }, { status: 404 })

  const { error } = await supabaseAdmin.from('news_posts').delete().eq('id', id)
  if (error) {
    console.error('[admin/news] delete error:', error)
    return NextResponse.json({ error: 'お知らせの削除に失敗しました' }, { status: 500 })
  }
  await writeAudit(auth.appUser.id, 'news_post_deleted', id, {
    title: existing.title, category: existing.category, status: existing.status,
  })
  return NextResponse.json({ success: true })
}
