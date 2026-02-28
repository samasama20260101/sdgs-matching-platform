// src/app/api/sos/cases/[id]/offers/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // offers取得
    const { data: offersData, error: offersError } = await supabaseAdmin
        .from('offers')
        .select('*')
        .eq('case_id', id)
        .in('status', ['PENDING', 'ACCEPTED'])
        .order('created_at', { ascending: false })

    if (offersError || !offersData) return NextResponse.json({ offers: [] })

    // サポーター情報を付加
    const offersWithSupporter = await Promise.all(
        offersData.map(async (offer) => {
            const { data: supporter } = await supabaseAdmin
                .from('users')
                .select('id, display_name, organization_name, supporter_type')
                .eq('id', offer.supporter_user_id)
                .single()
            return {
                ...offer,
                supporter: supporter || { id: '', display_name: '不明', organization_name: null, supporter_type: 'NPO' },
            }
        })
    )

    // バッジ取得
    const supporterIds = offersWithSupporter.map(o => o.supporter.id).filter(Boolean)
    let badgeData: { supporter_user_id: string; badge_key: string }[] = []
    if (supporterIds.length > 0) {
        const { data: badges } = await supabaseAdmin
            .from('supporter_badges')
            .select('supporter_user_id, badge_key')
            .in('supporter_user_id', supporterIds)
        badgeData = badges || []
    }

    return NextResponse.json({ offers: offersWithSupporter, badges: badgeData })
}