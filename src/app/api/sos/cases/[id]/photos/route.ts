// src/app/api/sos/cases/[id]/photos/route.ts
// 案件写真の追加(POST)・削除(DELETE)。案件のSOS本人のみ・OPEN/MATCHED中のみ・3枚まで。
// アップロード画像は sharp で再エンコード(リサイズ+WebP化)するため、EXIF(GPS位置情報等)は自動的に除去される。
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
    CASE_PHOTOS_BUCKET,
    CASE_PHOTO_ACCEPT_TYPES,
    CASE_PHOTO_MAX_UPLOAD_BYTES,
    MAX_CASE_PHOTOS,
    getCasePhotos,
    isCasePhotosEnabled,
    type CasePhoto,
} from '@/lib/constants/photos'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

const MUTABLE_CASE_STATUSES = new Set(['OPEN', 'MATCHED'])

function serverError() {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

async function loadOwnedCase(request: Request, id: string) {
    const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
    if ('response' in auth) return { response: auth.response }

    if (!isUuid(id)) {
        return { response: NextResponse.json({ error: '不正なIDです' }, { status: 400 }) }
    }

    const { data: caseData, error } = await supabaseAdmin
        .from('cases')
        .select('id, owner_user_id, status, intake_qna')
        .eq('id', id)
        .maybeSingle()
    if (error) {
        console.error('[sos/cases/photos] case fetch error:', error)
        return { response: serverError() }
    }
    if (!caseData) {
        return { response: NextResponse.json({ error: '案件が見つかりません' }, { status: 404 }) }
    }
    if (caseData.owner_user_id !== auth.appUser.id) {
        return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    if (!isCasePhotosEnabled(caseData.intake_qna)) {
        return { response: NextResponse.json({ error: 'この案件では写真を利用できません' }, { status: 400 }) }
    }
    if (!MUTABLE_CASE_STATUSES.has(caseData.status)) {
        return { response: NextResponse.json({ error: '進行中の案件のみ写真を変更できます' }, { status: 400 }) }
    }
    return { caseData }
}

async function savePhotos(caseId: string, intakeQna: unknown, photos: CasePhoto[]) {
    const nextIntake = { ...(intakeQna as Record<string, unknown>), photos }
    const { error } = await supabaseAdmin
        .from('cases')
        .update({ intake_qna: nextIntake })
        .eq('id', caseId)
    return error
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const loaded = await loadOwnedCase(request, id)
    if ('response' in loaded) return loaded.response
    const { caseData } = loaded

    const photos = getCasePhotos(caseData.intake_qna)
    if (photos.length >= MAX_CASE_PHOTOS) {
        return NextResponse.json({ error: `写真は${MAX_CASE_PHOTOS}枚までです`, code: 'LIMIT' }, { status: 400 })
    }

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 })
    }
    if (!CASE_PHOTO_ACCEPT_TYPES.includes(file.type)) {
        return NextResponse.json({ error: 'JPEG / PNG / WebP形式の画像を選択してください', code: 'TYPE' }, { status: 400 })
    }
    if (file.size > CASE_PHOTO_MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: '画像サイズは10MBまでです', code: 'SIZE' }, { status: 400 })
    }

    let processed: Buffer
    try {
        const buffer = Buffer.from(await file.arrayBuffer())
        // rotate()でEXIFの向きを反映してから再エンコード。メタデータ(GPS等)は引き継がない
        processed = await sharp(buffer)
            .rotate()
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer()
    } catch (error) {
        console.error('[sos/cases/photos] image process error:', error)
        return NextResponse.json({ error: '画像を処理できませんでした', code: 'TYPE' }, { status: 400 })
    }

    const photo: CasePhoto = {
        id: randomUUID(),
        path: `${caseData.id}/${randomUUID()}.webp`,
        created_at: new Date().toISOString(),
    }

    const { error: uploadError } = await supabaseAdmin.storage
        .from(CASE_PHOTOS_BUCKET)
        .upload(photo.path, processed, { contentType: 'image/webp' })
    if (uploadError) {
        console.error('[sos/cases/photos] upload error:', uploadError)
        return serverError()
    }

    const saveError = await savePhotos(caseData.id, caseData.intake_qna, [...photos, photo])
    if (saveError) {
        console.error('[sos/cases/photos] save error:', saveError)
        await supabaseAdmin.storage.from(CASE_PHOTOS_BUCKET).remove([photo.path])
        return serverError()
    }

    return NextResponse.json({ photo })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const loaded = await loadOwnedCase(request, id)
    if ('response' in loaded) return loaded.response
    const { caseData } = loaded

    const photoId = new URL(request.url).searchParams.get('photoId')
    const photos = getCasePhotos(caseData.intake_qna)
    const target = photos.find((p) => p.id === photoId)
    if (!target) {
        return NextResponse.json({ error: '写真が見つかりません' }, { status: 404 })
    }

    const saveError = await savePhotos(caseData.id, caseData.intake_qna, photos.filter((p) => p.id !== target.id))
    if (saveError) {
        console.error('[sos/cases/photos] delete save error:', saveError)
        return serverError()
    }

    // Storage側の削除失敗は致命的ではない(参照は既に消えている)ためログのみ
    const { error: removeError } = await supabaseAdmin.storage.from(CASE_PHOTOS_BUCKET).remove([target.path])
    if (removeError) console.error('[sos/cases/photos] storage remove error:', removeError)

    return NextResponse.json({ ok: true })
}
