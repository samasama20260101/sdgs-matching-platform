// src/app/api/public/supporters/[id]/route.ts（認証不要）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const { data: supporter, error } = await supabaseAdmin
        .from('users')
        .select('id, display_name, organization_name, supporter_type, service_area_nationwide, service_areas, bio, social_links, created_at')
        .eq('id', id)
        .eq('role', 'SUPPORTER')
        .single()

    if (error || !supporter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ count: resolvedCount }, { data: badges }] = await Promise.all([
        supabaseAdmin.from('offers').select('*', { count: 'exact', head: true })
            .eq('supporter_user_id', id).eq('status', 'ACCEPTED'),
        supabaseAdmin.from('supporter_badges')
            .select('badge_key, created_at')
            .eq('supporter_user_id', id)
            .order('created_at', { ascending: false }),
    ])

    const badgeSummary: Record<string, number> = {}
        ; (badges || []).forEach((b: { badge_key: string }) => {
            badgeSummary[b.badge_key] = (badgeSummary[b.badge_key] || 0) + 1
        })

    return NextResponse.json(
        { supporter: { ...supporter, resolved_count: resolvedCount ?? 0 }, badges: badgeSummary },
        { headers: { 'Cache-Control': 'no-store' } }
    )
}
