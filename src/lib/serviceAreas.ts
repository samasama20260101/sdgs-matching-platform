// src/lib/serviceAreas.ts
// サポーター団体の活動地域の入れ替え(/api/supporter/service-areas と /api/profile の共通処理)
//
// supporter_service_areas は「全削除 → 挿入」で入れ替えるが、PostgREST では 2 つの文が別々に確定する。
// 挿入に失敗すると団体の地域が消えたままになるので、
//   1. 消す前に入力を全部確かめる(形式・件数・重複・regions に実在するか)
//   2. 消す前に今の行を控え、挿入に失敗したら控えから戻す
// 本当の一括処理(DB 関数 1 つにまとめる)は、次に本番 DB を触るときに検討する。
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'

export type ServiceAreaInput = {
    region_code: string
    country: string
}

const COUNTRIES = new Set(['JP', 'ID'])
const MAX_SERVICE_AREAS = 50

// 不正な要素が 1 つでもあれば null。undefined は空として扱う。重複は 1 つにまとめる
export function sanitizeServiceAreas(value: unknown): ServiceAreaInput[] | null {
    if (value === undefined) return []
    if (!Array.isArray(value)) return null
    if (value.length > MAX_SERVICE_AREAS) return null

    const normalized = value.map((area) => {
        if (!area || typeof area !== 'object') return null
        const source = area as Record<string, unknown>
        const regionCode = typeof source.region_code === 'string' && source.region_code.trim()
            ? source.region_code.trim().slice(0, 32)
            : null
        const country = typeof source.country === 'string' && COUNTRIES.has(source.country) ? source.country : 'JP'
        if (!regionCode) return null
        return { region_code: regionCode, country }
    })

    if (normalized.some((area) => area === null)) return null

    const unique = new Map<string, ServiceAreaInput>()
    ;(normalized as ServiceAreaInput[]).forEach((area) => {
        unique.set(`${area.country}:${area.region_code}`, area)
    })
    return [...unique.values()]
}

type ReplaceResult = { ok: true } | { ok: false; status: 400 | 500; error: string }

export async function replaceOrganizationServiceAreas(params: {
    organizationId: string
    userId: string
    nationwide: unknown
    areas: unknown
}): Promise<ReplaceResult> {
    const { organizationId, userId } = params
    if (params.nationwide !== undefined && typeof params.nationwide !== 'boolean') {
        return { ok: false, status: 400, error: '全国対応フラグが不正です' }
    }
    const nationwide = params.nationwide === true

    // 1. 消す前に入れる行を確定させる
    let rows: Array<Record<string, unknown>>
    if (nationwide) {
        rows = [{ supporter_user_id: userId, organization_id: organizationId, region_code: null, country: 'JP', is_nationwide: true }]
    } else {
        const areas = sanitizeServiceAreas(params.areas)
        if (areas === null) {
            return { ok: false, status: 400, error: '活動地域の指定が不正です' }
        }
        if (areas.length > 0) {
            const { data: known, error: regionError } = await supabaseAdmin
                .from('regions')
                .select('code, country')
                .in('code', areas.map((a) => a.region_code))
            if (regionError) {
                console.error('[serviceAreas] regions lookup error:', regionError)
                return { ok: false, status: 500, error: 'サーバーエラーが発生しました' }
            }
            const knownKeys = new Set((known ?? []).map((r) => `${r.country}:${r.code}`))
            if (areas.some((a) => !knownKeys.has(`${a.country}:${a.region_code}`))) {
                return { ok: false, status: 400, error: '存在しない地域が含まれています' }
            }
        }
        rows = areas.map((a) => ({
            supporter_user_id: userId,
            organization_id: organizationId,
            region_code: a.region_code,
            country: a.country,
            is_nationwide: false,
        }))
    }

    // 2. 今の行を控える
    const { data: previous, error: previousError } = await supabaseAdmin
        .from('supporter_service_areas')
        .select('supporter_user_id, organization_id, region_code, country, is_nationwide')
        .eq('organization_id', organizationId)
    if (previousError) {
        console.error('[serviceAreas] previous rows fetch error:', previousError)
        return { ok: false, status: 500, error: 'サーバーエラーが発生しました' }
    }

    // 3. 入れ替える
    const { error: deleteError } = await supabaseAdmin
        .from('supporter_service_areas')
        .delete()
        .eq('organization_id', organizationId)
    if (deleteError) {
        console.error('[serviceAreas] delete error:', deleteError)
        return { ok: false, status: 500, error: 'サーバーエラーが発生しました' }
    }
    if (rows.length === 0) return { ok: true }

    const { error: insertError } = await supabaseAdmin.from('supporter_service_areas').insert(rows)
    if (!insertError) return { ok: true }

    // 4. 失敗したら控えから戻す
    console.error('[serviceAreas] insert error, restoring previous rows:', insertError)
    if (previous && previous.length > 0) {
        const { error: restoreError } = await supabaseAdmin.from('supporter_service_areas').insert(previous)
        if (restoreError) {
            console.error('[serviceAreas] restore error (areas are now empty):', restoreError, { organizationId, previous })
        }
    }
    return { ok: false, status: 500, error: '活動地域を保存できませんでした。もう一度お試しください' }
}
