// src/app/api/profile/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser } from '@/lib/organizations'
import { NextResponse } from 'next/server'

type ServiceAreaInput = {
    region_code: string
    country?: string | null
}

const PERSONAL_PROFILE_FIELDS = new Set([
    'real_name', 'display_name', 'phone', 'updated_at',
])
const SOS_PROFILE_FIELDS = new Set([
    'postal_code', 'prefecture', 'city', 'address_structured', 'sos_region_code',
])
const ORGANIZATION_PROFILE_FIELDS = new Set([
    'organization_name', 'organization_phone', 'supporter_type', 'bio', 'social_links',
    'postal_code', 'prefecture', 'city', 'address_structured',
])

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // service_areas（活動地域）を分離して別テーブルに保存
    const { service_areas, service_area_nationwide, ...rawUpdateData } = body
    const { data: currentUserData, error: currentUserError } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .single()

    if (currentUserError || !currentUserData) {
        return NextResponse.json({ error: currentUserError?.message ?? 'ユーザーが見つかりません' }, { status: 404 })
    }

    const organizationContext = currentUserData.role === 'SUPPORTER'
        ? await getActiveOrganizationForUser(currentUserData.id)
        : null

    if (currentUserData.role === 'SUPPORTER' && !organizationContext) {
        return NextResponse.json({ error: '有効な団体所属がありません', code: 'NO_ACTIVE_ORGANIZATION' }, { status: 403 })
    }
    const isOrganizationOwner = currentUserData.role === 'SUPPORTER' && organizationContext?.organizationRole === 'OWNER'
    const includesOrganizationUpdate = Object.keys(rawUpdateData).some((key) => ORGANIZATION_PROFILE_FIELDS.has(key))
        || service_areas !== undefined
        || service_area_nationwide !== undefined
    if (currentUserData.role === 'SUPPORTER' && !isOrganizationOwner && includesOrganizationUpdate) {
        return NextResponse.json({ error: '団体プロフィールを変更できるのはOWNERのみです', code: 'FORBIDDEN' }, { status: 403 })
    }
    const allowedUserFields = new Set(PERSONAL_PROFILE_FIELDS)
    if (currentUserData.role === 'SOS') {
        SOS_PROFILE_FIELDS.forEach((field) => allowedUserFields.add(field))
    }
    if (isOrganizationOwner) {
        ORGANIZATION_PROFILE_FIELDS.forEach((field) => allowedUserFields.add(field))
    }
    const updateData = Object.fromEntries(
        Object.entries(rawUpdateData).filter(([key]) => allowedUserFields.has(key))
    )

    // usersテーブル更新
    const { data: userData, error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('auth_user_id', user.id)
        .select('id, role')
        .single()

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // サポーター団体情報を organizations にも同期（D案への段階移行）
    if (userData?.role === 'SUPPORTER' && isOrganizationOwner && organizationContext?.organizationId) {
        const organizationUpdate: Record<string, unknown> = {}

        if (Object.prototype.hasOwnProperty.call(updateData, 'organization_name')) {
            organizationUpdate.name = updateData.organization_name
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'organization_phone')) {
            organizationUpdate.phone = updateData.organization_phone
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'supporter_type')) {
            organizationUpdate.supporter_type = updateData.supporter_type
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'bio')) {
            organizationUpdate.bio = updateData.bio
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'social_links')) {
            organizationUpdate.social_links = updateData.social_links
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'postal_code')) {
            organizationUpdate.postal_code = updateData.postal_code
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'prefecture')) {
            organizationUpdate.prefecture = updateData.prefecture
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'city')) {
            organizationUpdate.city = updateData.city
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'address_structured')) {
            organizationUpdate.address_structured = updateData.address_structured
        }

        if (Object.keys(organizationUpdate).length > 0) {
            const { error: organizationUpdateError } = await supabaseAdmin
                .from('organizations')
                .update(organizationUpdate)
                .eq('id', organizationContext.organizationId)

            if (organizationUpdateError) {
                console.error('[profile] organization update error:', organizationUpdateError)
                return NextResponse.json({ error: organizationUpdateError.message }, { status: 500 })
            }
        }
    }

    // サポーターの活動地域を更新
    if (userData?.role === 'SUPPORTER' && isOrganizationOwner && service_areas !== undefined) {
        // 既存データを全削除して入れ直す
        let deleteQuery = supabaseAdmin
            .from('supporter_service_areas')
            .delete()
        if (organizationContext?.organizationId) {
            deleteQuery = deleteQuery.eq('organization_id', organizationContext.organizationId)
        } else {
            deleteQuery = deleteQuery.eq('supporter_user_id', userData.id)
        }
        await deleteQuery

        if (service_area_nationwide) {
            // 全国対応：1レコードのみ
            await supabaseAdmin.from('supporter_service_areas').insert([{
                supporter_user_id: userData.id,
                organization_id: organizationContext?.organizationId ?? null,
                region_code: null,
                is_nationwide: true,
            }])
        } else if (Array.isArray(service_areas) && service_areas.length > 0) {
            const { error: insertError } = await supabaseAdmin.from('supporter_service_areas').insert(
                (service_areas as ServiceAreaInput[]).map((a) => ({
                    supporter_user_id: userData.id,
                    organization_id: organizationContext?.organizationId ?? null,
                    region_code: a.region_code,
                    country: a.country || 'JP',
                    is_nationwide: false,
                }))
            )
            if (insertError) {
                console.error('[profile] supporter_service_areas insert error:', insertError)
                return NextResponse.json({ error: insertError.message }, { status: 500 })
            }
        }
    }

    return NextResponse.json({ ok: true })
}
