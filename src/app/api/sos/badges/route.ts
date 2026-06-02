// src/app/api/sos/badges/route.ts
// SOS側：サポーターへのバッジ付与（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const BADGE_KEYS = new Set([
    'gold_medal',
    'silver_medal',
    'very_satisfied',
    'quick_response',
    'sincere_support',
    'problem_solved',
    'grateful_partner',
])

// POST: バッジを付与（upsert）
export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SOS') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { badges }: { badges: Array<{ case_id: string; supporter_organization_id: string; badge_key: string }> } = await request.json()

    if (!badges || badges.length === 0) {
        return NextResponse.json({ error: 'badges array required' }, { status: 400 })
    }

    // 全バッジがこのユーザーの案件のものか検証
    const caseIds = [...new Set(badges.map(b => b.case_id))]
    const { data: cases } = await supabaseAdmin
        .from('cases').select('id, owner_user_id').in('id', caseIds)

    const ownedCaseIds = new Set(
        (cases || []).filter(c => c.owner_user_id === userData.id).map(c => c.id)
    )

    const organizationIds = [...new Set(badges.map(b => b.supporter_organization_id).filter(Boolean))]
    const { data: acceptedOffers } = await supabaseAdmin
        .from('offers')
        .select('case_id, supporter_organization_id, supporter_user_id')
        .in('case_id', caseIds)
        .in('supporter_organization_id', organizationIds)
        .eq('status', 'ACCEPTED')
    const acceptedOfferMap = new Map(
        (acceptedOffers || []).map((offer: { case_id: string; supporter_organization_id: string; supporter_user_id: string }) => [
            `${offer.case_id}:${offer.supporter_organization_id}`,
            offer,
        ])
    )

    const validBadges = badges
        .filter(b => ownedCaseIds.has(b.case_id) && BADGE_KEYS.has(b.badge_key))
        .map(b => {
            const acceptedOffer = acceptedOfferMap.get(`${b.case_id}:${b.supporter_organization_id}`)
            if (!acceptedOffer) return null
            return {
            case_id: b.case_id,
            supporter_user_id: acceptedOffer.supporter_user_id,
            supporter_organization_id: b.supporter_organization_id,
            badge_key: b.badge_key,
            given_by_user_id: userData.id,
            }
        })
        .filter((badge): badge is NonNullable<typeof badge> => badge !== null)

    if (validBadges.length === 0) {
        return NextResponse.json({ error: 'No valid badges to insert' }, { status: 400 })
    }

    const { error: upsertError } = await supabaseAdmin
        .from('supporter_badges')
        .upsert(validBadges, { onConflict: 'case_id,supporter_organization_id,badge_key' })

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    return NextResponse.json({ ok: true, count: validBadges.length })
}
