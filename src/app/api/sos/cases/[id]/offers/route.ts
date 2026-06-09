// src/app/api/sos/cases/[id]/offers/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .single()
    if (!userData || userData.role !== 'SOS') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: caseData } = await supabaseAdmin
        .from('cases')
        .select('id, owner_user_id')
        .eq('id', id)
        .single()
    if (!caseData || caseData.owner_user_id !== userData.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
            const { data: organization } = await supabaseAdmin
                .from('organizations')
                .select('id, name, supporter_type')
                .eq('id', offer.supporter_organization_id)
                .single()
            return {
                ...offer,
                supporter: organization ? {
                    id: organization.id,
                    organization_id: organization.id,
                    display_name: organization.name,
                    organization_name: organization.name,
                    supporter_type: organization.supporter_type || 'NPO',
                } : {
                    id: offer.supporter_organization_id,
                    organization_id: offer.supporter_organization_id,
                    display_name: '不明',
                    organization_name: null,
                    supporter_type: 'NPO',
                },
            }
        })
    )

    // バッジ取得
    const organizationIds = offersWithSupporter.map(o => o.supporter.organization_id).filter(Boolean)
    let badgeData: { supporter_organization_id: string; badge_key: string }[] = []
    if (organizationIds.length > 0) {
        const { data: badges } = await supabaseAdmin
            .from('supporter_badges')
            .select('supporter_organization_id, badge_key')
            .in('supporter_organization_id', organizationIds)
        badgeData = badges || []
    }

    return NextResponse.json({ offers: offersWithSupporter, badges: badgeData })
}
