// 支援団体の写真(#178)。管理の人だけ。POST: 載せる・差し替える(フォームの file。画面で正方形の JPEG にしてから送る) / DELETE: 外す
// 形の決まりと付帯情報の削除は src/lib/domain/supporterPhoto.ts、置く・外すは src/lib/server/supporterPhotos.ts
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { myOrgRole } from '@/lib/server/orgAccess'
import { isSupporterPurpose } from '@/lib/domain/publicSupporter'
import { SUPPORTER_PHOTO_MAX_BYTES } from '@/lib/domain/supporterPhoto'
import { removeSupporterPhoto, saveSupporterPhoto } from '@/lib/server/supporterPhotos'

const SERVER_ERROR = { error: 'サーバーエラーが発生しました' }

// 管理の人で、支え手として登録した団体か(相談のための団体は公開の一覧に出ないので写真を持たない)
async function authorize(request: Request, id: string): Promise<{ userId: string } | { response: NextResponse }> {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth
  if (!isUuid(id)) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if ((await myOrgRole(auth.appUser.id, id)) !== 'OWNER') return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const { data: org, error } = await supabaseAdmin.from('organizations').select('application').eq('id', id).maybeSingle()
  if (error) return { response: NextResponse.json(SERVER_ERROR, { status: 500 }) }
  if (!org) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (!isSupporterPurpose(org.application)) return { response: NextResponse.json({ error: '支援団体だけが写真を載せられます', code: 'NOT_SUPPORTER' }, { status: 400 }) }
  return { userId: auth.appUser.id }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const who = await authorize(request, id)
  if ('response' in who) return who.response
  // 本文を読む前に大きさを見る(フォームの区切りの分だけ余裕を持たせる)
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > SUPPORTER_PHOTO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: '写真が大きすぎます', code: 'TOO_LARGE' }, { status: 413 })
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: '写真を選んでください', code: 'INVALID' }, { status: 400 })
  if (file.size > SUPPORTER_PHOTO_MAX_BYTES) return NextResponse.json({ error: '写真が大きすぎます', code: 'TOO_LARGE' }, { status: 413 })
  const result = await saveSupporterPhoto(id, new Uint8Array(await file.arrayBuffer()))
  if (!result.ok) {
    if (result.code === 'INVALID_IMAGE') return NextResponse.json({ error: '写真を読み取れませんでした', code: 'INVALID_IMAGE', reason: result.reason }, { status: 400 })
    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (result.code === 'CONFLICT') return NextResponse.json({ error: 'ほかの操作と重なりました。もう一度お試しください', code: 'CONFLICT' }, { status: 409 })
    return NextResponse.json(SERVER_ERROR, { status: 500 })
  }
  await supabaseAdmin.from('audit_logs').insert({ actor_user_id: who.userId, organization_id: id, action: 'organization.photo_update', target_table: 'organizations', target_id: id, metadata: {} })
  return NextResponse.json({ ok: true, photoUrl: result.photoUrl })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const who = await authorize(request, id)
  if ('response' in who) return who.response
  const result = await removeSupporterPhoto(id)
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (result.code === 'CONFLICT') return NextResponse.json({ error: 'ほかの操作と重なりました。もう一度お試しください', code: 'CONFLICT' }, { status: 409 })
    return NextResponse.json(SERVER_ERROR, { status: 500 })
  }
  if (result.removed) await supabaseAdmin.from('audit_logs').insert({ actor_user_id: who.userId, organization_id: id, action: 'organization.photo_remove', target_table: 'organizations', target_id: id, metadata: {} })
  return NextResponse.json({ ok: true })
}
