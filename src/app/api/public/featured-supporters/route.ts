// src/app/api/public/featured-supporters/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const { data: supporters, error } = await supabaseAdmin
            .from('users')
            .select('id, display_name, organization_name, supporter_type, bio, created_at, featured_order')
            .eq('role', 'SUPPORTER')
            .eq('is_featured', true)
            .order('featured_order', { ascending: true })

        if (error) {
            return NextResponse.json({ supporters: [], debug_error: error.message })
        }

        if (!supporters || supporters.length === 0) {
            // デバッグ：DBのfeatured状態を確認
            const { data: debug } = await supabaseAdmin
                .from('users').select('id, is_featured, featured_order').eq('role', 'SUPPORTER')
            return NextResponse.json({ supporters: [], debug_db: debug })
        }

        const ids = supporters.map((s: { id: string }) => s.id)

        // resolvedとbadgeはシンプルなクエリ
        const { data: resolvedOffers } = await supabaseAdmin
            .from('offers').select('supporter_user_id').in('supporter_user_id', ids).eq('status', 'ACCEPTED')
        const { data: badges } = await supabaseAdmin
            .from('supporter_badges').select('supporter_user_id').in('supporter_user_id', ids)

        // service_areasはregionsテーブルから名前も取得
        const { data: serviceAreas } = await supabaseAdmin
            .from('supporter_service_areas')
            .select('supporter_user_id, is_nationwide, region_code')
            .in('supporter_user_id', ids)

        // region_codeからname_localを取得
        const regionCodes = [...new Set((serviceAreas || [])
            .map((a: { region_code: string }) => a.region_code).filter(Boolean))]
        const { data: regionNames } = regionCodes.length > 0
            ? await supabaseAdmin.from('regions').select('region_code, name_local').in('region_code', regionCodes)
            : { data: [] }
        const regionNameMap: Record<string, string> = {}
        for (const r of (regionNames || [])) {
            const row = r as { region_code: string; name_local: string }
            regionNameMap[row.region_code] = row.name_local
        }

        const resolvedMap: Record<string, number> = {}
        for (const o of (resolvedOffers || [])) {
            const uid = (o as { supporter_user_id: string }).supporter_user_id
            resolvedMap[uid] = (resolvedMap[uid] || 0) + 1
        }
        const badgeMap: Record<string, number> = {}
        for (const b of (badges || [])) {
            const uid = (b as { supporter_user_id: string }).supporter_user_id
            badgeMap[uid] = (badgeMap[uid] || 0) + 1
        }

        const areaMap: Record<string, { name_local: string }[]> = {}
        const nationwideSet = new Set<string>()
        for (const a of (serviceAreas || [])) {
            const row = a as { supporter_user_id: string; is_nationwide: boolean; region_code: string }
            if (row.is_nationwide) {
                nationwideSet.add(row.supporter_user_id)
            } else {
                if (!areaMap[row.supporter_user_id]) areaMap[row.supporter_user_id] = []
                areaMap[row.supporter_user_id].push({ name_local: regionNameMap[row.region_code] || row.region_code })
            }
        }

        return NextResponse.json({
            supporters: supporters.map((s: { id: string }) => ({
                ...s,
                resolved_count: resolvedMap[s.id] || 0,
                badge_count: badgeMap[s.id] || 0,
                service_area_nationwide: nationwideSet.has(s.id),
                service_areas: areaMap[s.id] || [],
            }))
        }, { headers: { 'Cache-Control': 'no-store' } })

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ supporters: [], debug_error: msg })
    }
}
