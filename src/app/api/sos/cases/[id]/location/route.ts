// src/app/api/sos/cases/[id]/location/route.ts
// 災害案件の地域(市町村・校区等)の修正。案件のSOS本人のみ・OPEN/MATCHED中のみ。
// 登録時に間違えた場合に結果ページから直せるようにする。
import { requireActiveAppUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/api/validation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getDisasterEvent } from '@/lib/constants/disaster'
import { NextResponse } from 'next/server'

const MUTABLE_CASE_STATUSES = new Set(['OPEN', 'MATCHED'])

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
    if ('response' in auth) return auth.response

    const { id } = await params
    if (!isUuid(id)) {
        return NextResponse.json({ error: '不正なIDです' }, { status: 400 })
    }

    const { data: caseData, error } = await supabaseAdmin
        .from('cases')
        .select('id, owner_user_id, status, intake_qna')
        .eq('id', id)
        .maybeSingle()
    if (error) {
        console.error('[sos/cases/location] case fetch error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
    if (!caseData) {
        return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    }
    if (caseData.owner_user_id !== auth.appUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const intake = caseData.intake_qna as { disaster?: { event_id?: string; location?: unknown } } | null
    const event = getDisasterEvent(intake?.disaster?.event_id)
    if (!intake?.disaster || !event) {
        return NextResponse.json({ error: 'この案件では地域を設定できません' }, { status: 400 })
    }
    if (!MUTABLE_CASE_STATUSES.has(caseData.status)) {
        return NextResponse.json({ error: '進行中の案件のみ変更できます' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const municipalityRaw = (body as { municipality?: unknown }).municipality
    const areaRaw = (body as { area?: unknown }).area

    // 未選択(null/空)なら地域を削除。設定する場合はイベント定義のホワイトリストと照合
    let location: { municipality: string; area?: string } | null = null
    if (typeof municipalityRaw === 'string' && municipalityRaw) {
        if (!(event.municipalities || []).includes(municipalityRaw)) {
            return NextResponse.json({ error: '不正な市町村です' }, { status: 400 })
        }
        const areaOptions = event.localAreas?.[municipalityRaw]?.options || []
        const area = typeof areaRaw === 'string' && areaOptions.includes(areaRaw) ? areaRaw : undefined
        location = { municipality: municipalityRaw, ...(area ? { area } : {}) }
    }

    const nextDisaster = { ...intake.disaster } as Record<string, unknown>
    if (location) nextDisaster.location = location
    else delete nextDisaster.location

    const { error: updateError } = await supabaseAdmin
        .from('cases')
        .update({ intake_qna: { ...intake, disaster: nextDisaster } })
        .eq('id', caseData.id)
    if (updateError) {
        console.error('[sos/cases/location] save error:', updateError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ location })
}
