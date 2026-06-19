// src/app/api/public/featured-supporters/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const { data: supporters, error } = await supabaseAdmin
            .from('organizations')
            .select('id, name, supporter_type, bio, created_at, featured_order')
            .eq('status', 'ACTIVE')
            .eq('is_featured', true)
            .order('featured_order', { ascending: true })

        if (error) {
            return NextResponse.json({ supporters: [], debug_error: error.message })
        }

        if (!supporters || supporters.length === 0) {
            // デバッグ：DBのfeatured状態を確認
            const { data: debug } = await supabaseAdmin
                .from('organizations').select('id, is_featured, featured_order').eq('status', 'ACTIVE')
            return NextResponse.json({ supporters: [], debug_db: debug })
        }

        const ids = supporters.map((s: { id: string }) => s.id)

        // resolvedとbadgeはシンプルなクエリ
        const { data: resolvedOffers } = await supabaseAdmin
            .from('offers').select('supporter_organization_id').in('supporter_organization_id', ids).eq('status', 'ACCEPTED')
        const { data: badges } = await supabaseAdmin
            .from('supporter_badges').select('supporter_organization_id').in('supporter_organization_id', ids)

        // service_areasはregionsテーブルから名前も取得
        const { data: serviceAreas } = await supabaseAdmin
            .from('supporter_service_areas')
            .select('organization_id, is_nationwide, region_code')
            .in('organization_id', ids)

        // region_codeからname_localを取得（regionsテーブルのPKは"code"）
        const regionCodes = [...new Set((serviceAreas || [])
            .map((a: { region_code: string }) => a.region_code).filter(Boolean))]
        const { data: regionNames } = regionCodes.length > 0
            ? await supabaseAdmin.from('regions').select('code, name_local').in('code', regionCodes)
            : { data: [] }
        const regionNameMap: Record<string, string> = {}
        for (const r of (regionNames || [])) {
            const row = r as { code: string; name_local: string }
            regionNameMap[row.code] = row.name_local
        }

        const resolvedMap: Record<string, number> = {}
        for (const o of (resolvedOffers || [])) {
            const uid = (o as { supporter_organization_id: string }).supporter_organization_id
            resolvedMap[uid] = (resolvedMap[uid] || 0) + 1
        }
        const badgeMap: Record<string, number> = {}
        for (const b of (badges || [])) {
            const uid = (b as { supporter_organization_id: string }).supporter_organization_id
            badgeMap[uid] = (badgeMap[uid] || 0) + 1
        }

        const areaMap: Record<string, { name_local: string }[]> = {}
        const nationwideSet = new Set<string>()
        for (const a of (serviceAreas || [])) {
            const row = a as { organization_id: string; is_nationwide: boolean; region_code: string }
            if (row.is_nationwide) {
                nationwideSet.add(row.organization_id)
            } else {
                if (!areaMap[row.organization_id]) areaMap[row.organization_id] = []
                areaMap[row.organization_id].push({ name_local: regionNameMap[row.region_code] || row.region_code })
            }
        }

        return NextResponse.json({
            supporters: supporters.map((s: { id: string; name: string; supporter_type: string | null; bio: string | null; created_at: string; featured_order: number }) => ({
                id: s.id,
                display_name: s.name,
                organization_name: s.name,
                supporter_type: s.supporter_type,
                bio: s.bio,
                created_at: s.created_at,
                featured_order: s.featured_order,
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
