// src/app/api/cases/[id]/photos/route.ts
// 案件写真の署名付きURL取得。閲覧可: 案件のSOS本人 / アクティブなサポーター / 管理者。
// (サポーターにはマッチング前でも公開する — 申し出判断の材料とするユーザー決定)
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
    CASE_PHOTOS_BUCKET,
    CASE_PHOTO_SIGNED_URL_TTL_SECONDS,
    getCasePhotos,
} from '@/lib/constants/photos'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireActiveAppUser(request, { roles: ['SOS', 'SUPPORTER', 'ADMIN'] })
    if ('response' in auth) return auth.response

    const { id } = await params
    if (!isUuid(id)) {
        return NextResponse.json({ error: '不正なIDです' }, { status: 400 })
    }

    const { data: caseData, error } = await supabaseAdmin
        .from('cases')
        .select('id, owner_user_id, intake_qna')
        .eq('id', id)
        .maybeSingle()
    if (error) {
        console.error('[cases/photos] case fetch error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
    if (!caseData) {
        return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    }
    if (auth.appUser.role === 'SOS' && caseData.owner_user_id !== auth.appUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const photos = getCasePhotos(caseData.intake_qna)
    if (photos.length === 0) return NextResponse.json({ photos: [] })

    const { data: signed, error: signError } = await supabaseAdmin.storage
        .from(CASE_PHOTOS_BUCKET)
        .createSignedUrls(photos.map((p) => p.path), CASE_PHOTO_SIGNED_URL_TTL_SECONDS)
    if (signError) {
        console.error('[cases/photos] sign error:', signError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    const urlByPath = new Map((signed || []).map((s) => [s.path, s.signedUrl]))
    return NextResponse.json({
        photos: photos
            .map((p) => ({ id: p.id, url: urlByPath.get(p.path) || null, created_at: p.created_at }))
            .filter((p) => p.url),
    })
}
