// src/app/api/sos/cases/route.ts
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { ACTIVE_DISASTER_EVENT, DISASTER_EVENT_IDS, getDisasterEvent } from '@/lib/constants/disaster'
import { classifyDisasterNeedsForCase } from '@/lib/disasterNeeds'
import { detectUrgency } from '@/lib/urgency'
import { MAX_INDICATOR_SELECTIONS, findIndicator, hasUrgentIndicator } from '@/lib/constants/intakeIndicators'
import { NextResponse, after } from 'next/server'

const DESCRIPTION_FREE_MAX_LENGTH = 2000
const TITLE_MAX_LENGTH = 80
const ALLOWED_URGENCIES = new Set(['Low', 'Medium', 'High'])
const ALLOWED_REGION_COUNTRIES = new Set(['JP', 'ID'])
const ALLOWED_LOCALES = new Set(['ja', 'en', 'zh', 'ko', 'vi', 'id'])
// 開いている案件(OPEN・MATCHED)は 1 人 3 件まで。画面でも止めているが、API を直接呼ばれても止める
const MAX_ACTIVE_CASES = 3
// 1 人が 24 時間に登録できる件数(取り消したものも数える)。登録→取り消しを繰り返して AI を動かし続けるのを防ぐ。
// 本番だけ 10 件。Staging(Vercel の preview)とローカルはテストしやすいよう上限なし
const DAILY_CASE_LIMIT = process.env.VERCEL_ENV === 'production' ? 10 : null

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
    // 新規登録は受付中のイベントに限る(POST 側で先に 400 を返すが、ここでも通さない)
    if (ACTIVE_DISASTER_EVENT?.id !== eventId) return null

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

    // 地域(任意)。市町村・区分ともイベント設定のホワイトリストと照合する
    const event = getDisasterEvent(eventId)
    const locationRaw = (value as { location?: unknown }).location
    let location: { municipality: string; area?: string } | null = null
    if (event && locationRaw && typeof locationRaw === 'object' && !Array.isArray(locationRaw)) {
        const municipality = (locationRaw as { municipality?: unknown }).municipality
        if (typeof municipality === 'string' && (event.municipalities || []).includes(municipality)) {
            const areaRaw = (locationRaw as { area?: unknown }).area
            const areaOptions = event.localAreas?.[municipality]?.options || []
            const area = typeof areaRaw === 'string' && areaOptions.includes(areaRaw) ? areaRaw : undefined
            location = { municipality, ...(area ? { area } : {}) }
        }
    }

    return { event_id: eventId, answers, ...(location ? { location } : {}) }
}

// 通常案件は困りごとの選択肢(指標 ID 0〜3 個)を受け取る(version 2)。旧 Q1〜Q5 形式は受け付けない。
// 指標 ID はホワイトリストで検証し、文言スナップショットは ID と同じ数だけ残す。
function sanitizeIntakeQna(value: unknown, fallbackLocale: string) {
    // intake_qna が無い通常案件も新形式(選択 0 個)として保存する。null にすると AI 分析が旧方式(AI が分類)に落ちるため
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { version: 2, indicators: [] as string[], indicator_texts: [] as string[], locale: fallbackLocale }
    }
    const disaster = sanitizeDisaster((value as { disaster?: unknown }).disaster)
    const locale = sanitizeLocale((value as { locale?: unknown }).locale) || fallbackLocale
    if (disaster) {
        // 災害SOSは選択肢なしで登録する
        return { qa: {}, qa_ids: {}, disaster, locale }
    }

    const rawIds = (value as { indicators?: unknown }).indicators
    const rawTexts = (value as { indicator_texts?: unknown }).indicator_texts
    const indicators: string[] = []
    const indicatorTexts: string[] = []
    if (Array.isArray(rawIds)) {
        rawIds.forEach((id, index) => {
            if (indicators.length >= MAX_INDICATOR_SELECTIONS) return
            if (typeof id !== 'string' || !findIndicator(id) || indicators.includes(id)) return
            const text = Array.isArray(rawTexts) ? sanitizeText(rawTexts[index], 250) : ''
            indicators.push(id)
            indicatorTexts.push(text || findIndicator(id)!.text)
        })
    }

    return { version: 2, indicators, indicator_texts: indicatorTexts, locale }
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

    // 災害SOS: 受付終了後はフォームが閉じているが、APIも同じ判断にする。
    // 黙って通常案件に格下げすると AI分析を通らず非公開のまま残るため、明示的に拒否する
    const requestedDisaster = (body.intake_qna as { disaster?: unknown } | null | undefined)?.disaster
    if (requestedDisaster !== undefined && requestedDisaster !== null) {
        const requestedEventId = (requestedDisaster as { event_id?: unknown }).event_id
        if (typeof requestedEventId !== 'string' || ACTIVE_DISASTER_EVENT?.id !== requestedEventId) {
            return NextResponse.json({ error: 'この災害SOSの受付は終了しました' }, { status: 400 })
        }
    }

    // 登録数の上限(開いている案件の数 / 24 時間の登録数)
    const { count: activeCount, error: activeCountError } = await supabaseAdmin
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', userData.id)
        .in('status', ['OPEN', 'MATCHED'])
    if (activeCountError) {
        console.error('[sos/cases] active case count error:', activeCountError)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
    if ((activeCount ?? 0) >= MAX_ACTIVE_CASES) {
        return NextResponse.json({ error: 'ACTIVE_CASE_LIMIT' }, { status: 409 })
    }
    if (DAILY_CASE_LIMIT !== null) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { count: recentCount, error: recentCountError } = await supabaseAdmin
            .from('cases')
            .select('id', { count: 'exact', head: true })
            .eq('owner_user_id', userData.id)
            .gte('created_at', since)
        if (recentCountError) {
            console.error('[sos/cases] recent case count error:', recentCountError)
            return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
        }
        if ((recentCount ?? 0) >= DAILY_CASE_LIMIT) {
            return NextResponse.json({ error: 'DAILY_CASE_LIMIT' }, { status: 429 })
        }
    }

    // 旧フォーム(Q1〜Q5)のまま開いていた画面からの送信は、回答が捨てられて分類 18 になるので受け付けない
    const legacyIntake = body.intake_qna as { qa?: unknown; indicators?: unknown } | null | undefined
    if (legacyIntake?.qa !== undefined && legacyIntake.indicators === undefined && requestedDisaster == null) {
        return NextResponse.json({ error: 'フォームが新しくなりました。ページを再読み込みしてから、もう一度送信してください' }, { status: 400 })
    }

    const intakeQna = sanitizeIntakeQna(body.intake_qna, locale)
    // 緊急フラグ付きの選択肢・自由記述の緊急語句があれば、クライアントの判定によらず High にする
    const caseUrgency = hasUrgentIndicator(intakeQna?.indicators ?? []) || detectUrgency(descriptionFree) ? 'High' : urgency

    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .insert([{
            owner_user_id: userData.id,
            title,
            description_free: descriptionFree,
            intake_qna: intakeQna,
            urgency: caseUrgency,
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
