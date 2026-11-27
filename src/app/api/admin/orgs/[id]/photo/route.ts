// 運営｜支援団体の写真を外す(#178。合わない写真のとき)。団体の管理の人はあとから別の写真を載せられる。操作は監査ログに残す
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { removeSupporterPhoto } from '@/lib/server/supporterPhotos'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const result = await removeSupporterPhoto(id)
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (result.code === 'CONFLICT') return NextResponse.json({ error: 'ほかの操作と重なりました。もう一度お試しください', code: 'CONFLICT' }, { status: 409 })
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  if (result.removed) await supabaseAdmin.from('audit_logs').insert({ actor_user_id: auth.appUser.id, organization_id: id, action: 'admin.organization_photo_remove', target_table: 'organizations', target_id: id, metadata: {} })
  return NextResponse.json({ ok: true })
}
