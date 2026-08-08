// src/app/api/sos/cases/route.ts
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { DISASTER_EVENT_IDS } from '@/lib/constants/disaster'
import { classifyDisasterNeedsForCase } from '@/lib/disasterNeeds'
import { NextResponse, after } from 'next/server'

const DESCRIPTION_FREE_MAX_LENGTH = 2000
const TITLE_MAX_LENGTH = 80
const ALLOWED_URGENCIES = new Set(['Low', 'Medium', 'High'])
const ALLOWED_REGION_COUNTRIES = new Set(['JP', 'ID'])
const ALLOWED_LOCALES = new Set(['ja', 'en', 'zh', 'ko', 'vi', 'id'])

type CaseRow = {
    id: string
    status: string
}

type OfferRow = {
    case_id: string
}

function sanitizeText(value: unknown, maxLength: number) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function sanitizeLocale(value: unknown) {
    return typeof value === 'string' && ALLOWED_LOCALES.has(value) ? value : null
}

// 災害SOSフロー: intake_qna.disaster を検証して通す(event_idはホワイトリスト制)
function sanitizeDisaster(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const eventId = (value as { event_id?: unknown }).event_id
    if (typeof eventId !== 'string' || !DISASTER_EVENT_IDS.has(eventId)) return null

    const answersRaw = (value as { answers?: unknown }).answers
    const answers: Record<string, string> = {}
    if (answersRaw && typeof answersRaw === 'object' && !Array.isArray(answersRaw)) {
        for (const key of ['situation', 'since', 'wish']) {
            const answer = (answersRaw as Record<string, unknown>)[key]
            if (typeof answer === 'string' && answer.trim()) {
                answers[key] = answer.trim().slice(0, 600)
            }
        }
    }
    return { event_id: eventId, answers }
}

function sanitizeIntakeQna(value: unknown, fallbackLocale: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const disaster = sanitizeDisaster((value as { disaster?: unknown }).disaster)
    const qa = (value as { qa?: unknown }).qa
    if (!qa || typeof qa !== 'object' || Array.isArray(qa)) {
        // 災害SOSはQ&Aなしで登録できる
        if (!disaster) return null
        return {
            qa: {},
            qa_ids: {},
            disaster,
            locale: sanitizeLocale((value as { locale?: unknown }).locale) || fallbackLocale,
        }
    }

    const sanitizedQa: Record<string, string[]> = {}
    for (const [rawKey, rawAnswers] of Object.entries(qa as Record<string, unknown>)) {
        if (!/^[1-5]$/.test(rawKey) && !/^q[1-5]$/.test(rawKey)) continue
        if (!Array.isArray(rawAnswers)) continue
        sanitizedQa[rawKey] = rawAnswers
            .filter((answer): answer is string => typeof answer === 'string')
            .map((answer) => answer.trim().slice(0, 250))
            .filter(Boolean)
            .slice(0, 10)
    }

    const sanitizedQaIds: Record<string, string[]> = {}
    const qaIds = (value as { qa_ids?: unknown }).qa_ids
    if (qaIds && typeof qaIds === 'object' && !Array.isArray(qaIds)) {
        for (const [rawKey, rawIds] of Object.entries(qaIds as Record<string, unknown>)) {
            if (!/^[1-5]$/.test(rawKey) && !/^q[1-5]$/.test(rawKey)) continue
            if (!Array.isArray(rawIds)) continue
            sanitizedQaIds[rawKey] = rawIds
                .filter((id): id is string => typeof id === 'string')
                .map((id) => id.trim())
                .filter((id) => /^q[1-5]_(?:[1-9][0-9]*|other)$/.test(id))
                .slice(0, 10)
        }
    }

    return {
        qa: sanitizedQa,
        qa_ids: sanitizedQaIds,
        ...(disaster ? { disaster } : {}),
        locale: sanitizeLocale((value as { locale?: unknown }).locale) || fallbackLocale,
    }
}

export async function GET(request: Request) {
    const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
    if ('response' in auth) return auth.response
    const userData = auth.appUser

    const { data: cases, error: casesError } = await supabaseAdmin
        .from('cases').select('*').eq('owner_user_id', userData.id).order('created_at', { ascending: false })
    if (casesError) {
        console.error('[sos/cases] cases fetch error:', casesError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    if (!cases || cases.length === 0) return NextResponse.json({ cases: [], userId: userData.id })

    // OPENケースのPENDINGオファー数を取得
    const caseRows = (cases || []) as CaseRow[]
    const openCaseIds = caseRows.filter((c) => c.status === 'OPEN').map((c) => c.id)
    const offerCountMap: Record<string, number> = {}
    if (openCaseIds.length > 0) {
        const { data: offers } = await supabaseAdmin
            .from('offers')
            .select('case_id')
            .in('case_id', openCaseIds)
            .eq('status', 'PENDING')
        ;((offers || []) as OfferRow[]).forEach((o) => {
            offerCountMap[o.case_id] = (offerCountMap[o.case_id] || 0) + 1
        })
    }

    const enriched = caseRows.map((c) => ({
        ...c,
        pending_offer_count: offerCountMap[c.id] || 0,
    }))

    return NextResponse.json({ cases: enriched, userId: userData.id })
}

export async function POST(request: Request) {
    const auth = await requireActiveAppUser(request, { roles: ['SOS'] })
    if ('response' in auth) return auth.response
    const userData = auth.appUser

    const body = await request.json()
    const descriptionFree = sanitizeText(body.description_free, DESCRIPTION_FREE_MAX_LENGTH)
    if (!descriptionFree) {
        return NextResponse.json({ error: '相談内容を入力してください' }, { status: 400 })
    }
    if (typeof body.description_free === 'string' && body.description_free.length > DESCRIPTION_FREE_MAX_LENGTH) {
        return NextResponse.json({ error: `相談内容は${DESCRIPTION_FREE_MAX_LENGTH}文字以内で入力してください` }, { status: 400 })
    }

    const title = sanitizeText(body.title, TITLE_MAX_LENGTH) || descriptionFree.slice(0, 50) || '相談'
    const urgency = typeof body.urgency === 'string' && ALLOWED_URGENCIES.has(body.urgency) ? body.urgency : 'Medium'
    const regionCountry = typeof body.region_country === 'string' && ALLOWED_REGION_COUNTRIES.has(body.region_country)
        ? body.region_country
        : 'JP'
    const locale = sanitizeLocale(body.locale) || sanitizeLocale(body.intake_qna?.locale) || 'ja'

    const intakeQna = sanitizeIntakeQna(body.intake_qna, locale)

    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .insert([{
            owner_user_id: userData.id,
            title,
            description_free: descriptionFree,
            intake_qna: intakeQna,
            urgency,
            locale,
            region_country: regionCountry,
            status: 'OPEN',
            // 通常案件はAI分析完了時(gemini/analyze)にLISTEDへ切り替わるが、
            // 災害SOSはAI分析を通らないため登録時点で公開する
            ...(intakeQna?.disaster ? { visibility: 'LISTED' } : {}),
        }])
        .select()
        .single()
    if (caseError) {
        console.error('[sos/cases] case insert error:', caseError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    // 災害案件: 応答を返した後にバックグラウンドでニーズ分類(AIは注釈者。失敗しても案件は公開済みのまま・夜間cronが再試行)
    if (intakeQna?.disaster && caseData) {
        after(() =>
            classifyDisasterNeedsForCase(caseData.id).catch((error) => {
                console.error('[sos/cases] needs classify error:', error)
            })
        )
    }

    return NextResponse.json({ case: caseData })
}
