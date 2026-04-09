// src/app/api/supporter/cases/[id]/route.ts
// サポーター用：案件取得・ステータス更新（RLSバイパス）
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAuthUser(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user
}

// GET: 案件詳細取得（サポーターはどのOPEN案件も閲覧可）
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // サポーターであることを確認
    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases').select('*').eq('id', id).single()
    if (caseError || !caseData) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // 承認済みオファーのorder一覧を取得（主/副判定用）
    const { data: acceptedOffers } = await supabaseAdmin
        .from('offers')
        .select('supporter_user_id, accepted_order, status')
        .eq('case_id', id)
        .eq('status', 'ACCEPTED')
        .order('accepted_order', { ascending: true })

    // 承認済みサポーターのプロフィールを2ステップで取得（協業用）
    const supporterIds = (acceptedOffers ?? []).map((o: { supporter_user_id: string }) => o.supporter_user_id)
    let supporterProfiles: Record<string, { display_name: string; organization_name: string | null; supporter_type: string }> = {}
    if (supporterIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
            .from('users')
            .select('id, display_name, organization_name, supporter_type')
            .in('id', supporterIds)
        ;(profiles ?? []).forEach((p: { id: string; display_name: string; organization_name: string | null; supporter_type: string }) => {
            supporterProfiles[p.id] = {
                display_name: p.display_name,
                organization_name: p.organization_name,
                supporter_type: p.supporter_type,
            }
        })
    }

    // acceptedOffers にプロフィール情報を付加
    const acceptedOffersWithProfile = (acceptedOffers ?? []).map((o: { supporter_user_id: string; accepted_order: number; status: string }) => ({
        ...o,
        profile: supporterProfiles[o.supporter_user_id] ?? null,
    }))

    // オーナーの birth_date を取得（未成年判定用）
    const { data: ownerData } = await supabaseAdmin
        .from('users')
        .select('birth_date')
        .eq('id', caseData.owner_user_id)
        .single()

    return NextResponse.json({
        case: caseData,
        supporterUserId: userData.id,
        acceptedOffers: acceptedOffersWithProfile,
        ownerBirthDate: ownerData?.birth_date ?? null,
    })
}

// PATCH: 案件ステータス更新（サポーターが担当している案件のみ）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin
        .from('users').select('id, role').eq('auth_user_id', user.id).single()
    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 自分がACCEPTED状態のオファーを持っているか確認
    const { data: offer } = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('case_id', id)
        .eq('supporter_user_id', userData.id)
        .eq('status', 'ACCEPTED')
        .maybeSingle()

    if (!offer) {
        return NextResponse.json({ error: 'Not authorized for this case' }, { status: 403 })
    }

    const body = await request.json()
    const { error: updateError } = await supabaseAdmin
        .from('cases').update(body).eq('id', id)
    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}