// src/app/api/admin/stats/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    // ADMIN確認
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminUser } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

    if (!adminUser || adminUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // サポーター一覧
    const { data: supporters } = await supabaseAdmin
        .from('users')
        .select('id, real_name, display_name, email, organization_name, supporter_type, phone, created_at, is_suspended')
        .eq('role', 'SUPPORTER')
        .order('created_at', { ascending: false })

    // SOSユーザー一覧
    const { data: sosUsers } = await supabaseAdmin
        .from('users')
        .select('id, display_name, real_name, email, created_at, sos_region_code, birth_date, is_suspended')
        .eq('role', 'SOS')
        .order('created_at', { ascending: false })

    const sosRegionCodes = [
        ...new Set((sosUsers ?? [])
            .map((u: { sos_region_code: string | null }) => u.sos_region_code)
            .filter(Boolean)),
    ] as string[]
    const regionMap: Record<string, { name_local: string; name_en: string | null }> = {}
    if (sosRegionCodes.length > 0) {
        const { data: regions } = await supabaseAdmin
            .from('regions')
            .select('code, name_local, name_en')
            .in('code', sosRegionCodes)
        ;((regions ?? []) as Array<{ code: string; name_local: string; name_en: string | null }>).forEach((region) => {
            regionMap[region.code] = {
                name_local: region.name_local,
                name_en: region.name_en,
            }
        })
    }

    const sosUsersWithRegion = (sosUsers ?? []).map((u: { sos_region_code: string | null; [key: string]: unknown }) => ({
        ...u,
        sos_region_name: u.sos_region_code ? regionMap[u.sos_region_code]?.name_local ?? null : null,
        sos_region_known: u.sos_region_code ? Boolean(regionMap[u.sos_region_code]) : false,
    }))

    // 案件一覧（全件）── FK JOIN を使わず2ステップで取得
    const { data: cases, error: casesError } = await supabaseAdmin
        .from('cases')
        .select('id, title, status, created_at, region_code, owner_user_id')
        .order('created_at', { ascending: false })

    if (casesError) {
        console.error('[admin/stats] cases fetch error:', casesError)
    }

    // オーナーのdisplay_nameを2ステップで取得
    const ownerIds = [...new Set((cases ?? []).map((c: { owner_user_id: string }) => c.owner_user_id))]
    const ownerMap: Record<string, string> = {}
    if (ownerIds.length > 0) {
        const { data: owners } = await supabaseAdmin
            .from('users')
            .select('id, display_name')
            .in('id', ownerIds)
        ;(owners ?? []).forEach((u: { id: string; display_name: string }) => {
            ownerMap[u.id] = u.display_name
        })
    }

    const casesWithOwner = (cases ?? []).map((c: { owner_user_id: string; [key: string]: unknown }) => ({
        ...c,
        users: { display_name: ownerMap[c.owner_user_id] ?? null },
    }))

    const caseStats = {
        open: (cases ?? []).filter((c: { status: string }) => c.status === 'OPEN').length,
        in_progress: (cases ?? []).filter((c: { status: string }) => c.status === 'MATCHED').length,
        resolved: (cases ?? []).filter((c: { status: string }) => c.status === 'RESOLVED').length,
    }

    return NextResponse.json({
        supporters: supporters ?? [],
        sosUsers: sosUsersWithRegion,
        sosCount: sosUsersWithRegion.length,
        cases: casesWithOwner,
        caseStats,
    })
}
