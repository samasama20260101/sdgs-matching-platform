// src/app/api/admin/news/link-preview/route.ts
// 管理者: 「見え方を確認」でリンク先のカード(画像・タイトル・説明)を出すための情報を取る。公開ページと同じ取得の仕組みを使う。
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { fetchLinkPreview } from '@/lib/news/linkPreview'

export async function POST(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['ADMIN'] })
  if ('response' in auth) return auth.response

  let body: { url?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }
  if (typeof body.url !== 'string' || !body.url.trim() || body.url.length > 2000) {
    return NextResponse.json({ error: 'URL が不正です' }, { status: 400 })
  }
  return NextResponse.json({ preview: await fetchLinkPreview(body.url.trim()) })
}
