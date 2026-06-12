// src/app/api/profile/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser } from '@/lib/organizations'
import { requireActiveAppUser } from '@/lib/api/auth'
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
const SUPPORTER_TYPES = new Set(['NPO', 'CORPORATE', 'GOVERNMENT'])
const SOCIAL_LINK_KEYS = new Set(['website', 'twitter', 'instagram', 'facebook', 'line'])
const COUNTRIES = new Set(['JP', 'ID'])

function sanitizeText(value: unknown, maxLength: number) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null
}

function sanitizeRequiredText(value: unknown, maxLength: number) {
    const sanitized = sanitizeText(value, maxLength)
    return sanitized && sanitized.length > 0 ? sanitized : null
}

function sanitizeAddressStructured(value: unknown) {
    if (value === null || value === undefined) return null
    if (typeof value !== 'object' || Array.isArray(value)) return null

    const source = value as Record<string, unknown>
    const country = source.country === 'ID' ? 'ID' : 'JP'
    return {
        country,
        postal_code: sanitizeText(source.postal_code, 20) ?? '',
        prefecture: sanitizeText(source.prefecture, 64) ?? '',
        city: sanitizeText(source.city, 64) ?? '',
        line1: sanitizeText(source.line1, 120) ?? '',
        line2: sanitizeText(source.line2, 120) ?? '',
    }
}

function sanitizeSocialLinks(value: unknown) {
    if (value === null || value === undefined) return null
    if (typeof value !== 'object' || Array.isArray(value)) return null

    const sanitized: Record<string, string> = {}
    Object.entries(value as Record<string, unknown>).forEach(([key, rawValue]) => {
        if (!SOCIAL_LINK_KEYS.has(key)) return
        const maxLength = key === 'website' || key === 'facebook' ? 200 : 80
        const text = sanitizeText(rawValue, maxLength)
        if (text) sanitized[key] = text
    })
    return Object.keys(sanitized).length > 0 ? sanitized : null
}

function sanitizeServiceAreas(value: unknown): ServiceAreaInput[] | null {
    if (value === undefined) return []
    if (!Array.isArray(value)) return null
    if (value.length > 50) return null

    const normalized = value.map((area) => {
        if (!area || typeof area !== 'object') return null
        const source = area as Record<string, unknown>
        const regionCode = sanitizeText(source.region_code, 32)
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

function serverError() {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
}

export async function POST(request: Request) {
    const auth = await requireActiveAppUser(request, { roles: ['SOS', 'SUPPORTER'] })
    if ('response' in auth) return auth.response

    const body = await request.json()

    // service_areas（活動地域）を分離して別テーブルに保存
    const { service_areas, service_area_nationwide, ...rawUpdateData } = body
    const { data: currentUserData, error: currentUserError } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', auth.appUser.id)
        .single()

    if (currentUserError || !currentUserData) {
        if (currentUserError) console.error('[profile] current user fetch error:', currentUserError)
        return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
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
    const updateData: Record<string, unknown> = {}
    if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'real_name')) {
        const realName = sanitizeRequiredText(rawUpdateData.real_name, 64)
        if (!realName) return NextResponse.json({ error: '氏名を入力してください' }, { status: 400 })
        updateData.real_name = realName
    }
    if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'display_name')) {
        const displayName = sanitizeRequiredText(rawUpdateData.display_name, 64)
        if (!displayName) return NextResponse.json({ error: '表示名を入力してください' }, { status: 400 })
        updateData.display_name = displayName
    }
    if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'phone')) {
        updateData.phone = sanitizeText(rawUpdateData.phone, 30)
    }
    if (allowedUserFields.has('postal_code') && Object.prototype.hasOwnProperty.call(rawUpdateData, 'postal_code')) {
        updateData.postal_code = sanitizeText(rawUpdateData.postal_code, 20)
    }
    if (allowedUserFields.has('prefecture') && Object.prototype.hasOwnProperty.call(rawUpdateData, 'prefecture')) {
        updateData.prefecture = sanitizeText(rawUpdateData.prefecture, 64)
    }
    if (allowedUserFields.has('city') && Object.prototype.hasOwnProperty.call(rawUpdateData, 'city')) {
        updateData.city = sanitizeText(rawUpdateData.city, 64)
    }
    if (allowedUserFields.has('address_structured') && Object.prototype.hasOwnProperty.call(rawUpdateData, 'address_structured')) {
        updateData.address_structured = sanitizeAddressStructured(rawUpdateData.address_structured)
    }
    if (allowedUserFields.has('sos_region_code') && Object.prototype.hasOwnProperty.call(rawUpdateData, 'sos_region_code')) {
        updateData.sos_region_code = sanitizeText(rawUpdateData.sos_region_code, 32)
    }
    if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString()
    }

    const membershipUpdate: Record<string, string | null> = {}
    if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'membership_department')) {
        membershipUpdate.department = sanitizeText(rawUpdateData.membership_department, 100)
    }
    if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'membership_external_phone')) {
        membershipUpdate.external_phone = sanitizeText(rawUpdateData.membership_external_phone, 30)
    }
    if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'membership_phone_extension')) {
        membershipUpdate.phone_extension = sanitizeText(rawUpdateData.membership_phone_extension, 30)
    }
    const includesMembershipUpdate = Object.keys(membershipUpdate).length > 0

    // usersテーブル更新
    let userData = currentUserData
    if (Object.keys(updateData).length > 0) {
        const { data: updatedUserData, error: updateError } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', auth.appUser.id)
            .select('id, role')
            .single()

        if (updateError) {
            console.error('[profile] user update error:', updateError)
            return serverError()
        }
        userData = updatedUserData
    }

    if (currentUserData.role === 'SUPPORTER' && organizationContext?.membershipId && includesMembershipUpdate) {
        const { error: membershipUpdateError } = await supabaseAdmin
            .from('organization_memberships')
            .update(membershipUpdate)
            .eq('id', organizationContext.membershipId)
        if (membershipUpdateError) {
            console.error('[profile] membership update error:', membershipUpdateError)
            return serverError()
        }
    }

    // サポーター団体情報を organizations にも同期（D案への段階移行）
    if (userData?.role === 'SUPPORTER' && isOrganizationOwner && organizationContext?.organizationId) {
        const organizationUpdate: Record<string, unknown> = {}

        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'organization_name')) {
            organizationUpdate.name = sanitizeText(rawUpdateData.organization_name, 64)
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'organization_phone')) {
            organizationUpdate.phone = sanitizeText(rawUpdateData.organization_phone, 30)
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'supporter_type')) {
            if (typeof rawUpdateData.supporter_type !== 'string' || !SUPPORTER_TYPES.has(rawUpdateData.supporter_type)) {
                return NextResponse.json({ error: '団体種別が不正です' }, { status: 400 })
            }
            organizationUpdate.supporter_type = rawUpdateData.supporter_type
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'bio')) {
            organizationUpdate.bio = sanitizeText(rawUpdateData.bio, 2000)
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'social_links')) {
            organizationUpdate.social_links = sanitizeSocialLinks(rawUpdateData.social_links)
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'postal_code')) {
            organizationUpdate.postal_code = sanitizeText(rawUpdateData.postal_code, 20)
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'prefecture')) {
            organizationUpdate.prefecture = sanitizeText(rawUpdateData.prefecture, 64)
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'city')) {
            organizationUpdate.city = sanitizeText(rawUpdateData.city, 64)
        }
        if (Object.prototype.hasOwnProperty.call(rawUpdateData, 'address_structured')) {
            organizationUpdate.address_structured = sanitizeAddressStructured(rawUpdateData.address_structured)
        }

        if (Object.keys(organizationUpdate).length > 0) {
            const { error: organizationUpdateError } = await supabaseAdmin
                .from('organizations')
                .update(organizationUpdate)
                .eq('id', organizationContext.organizationId)

            if (organizationUpdateError) {
                console.error('[profile] organization update error:', organizationUpdateError)
                return serverError()
            }
        }
    }

    // サポーターの活動地域を更新
    if (userData?.role === 'SUPPORTER' && isOrganizationOwner && organizationContext && service_areas !== undefined) {
        if (service_area_nationwide !== undefined && typeof service_area_nationwide !== 'boolean') {
            return NextResponse.json({ error: '全国対応フラグが不正です' }, { status: 400 })
        }

        // 既存データを全削除して入れ直す
        const { error: deleteError } = await supabaseAdmin
            .from('supporter_service_areas')
            .delete()
            .eq('organization_id', organizationContext.organizationId)
        if (deleteError) {
            console.error('[profile] supporter_service_areas delete error:', deleteError)
            return serverError()
        }

        if (service_area_nationwide === true) {
            // 全国対応：1レコードのみ
            const { error: insertError } = await supabaseAdmin.from('supporter_service_areas').insert([{
                supporter_user_id: userData.id,
                organization_id: organizationContext.organizationId,
                region_code: null,
                is_nationwide: true,
            }])
            if (insertError) {
                console.error('[profile] supporter_service_areas nationwide insert error:', insertError)
                return serverError()
            }
        } else {
            const sanitizedServiceAreas = sanitizeServiceAreas(service_areas)
            if (sanitizedServiceAreas === null) {
                return NextResponse.json({ error: '活動地域の指定が不正です' }, { status: 400 })
            }
            if (sanitizedServiceAreas.length === 0) return NextResponse.json({ ok: true })
            const { error: insertError } = await supabaseAdmin.from('supporter_service_areas').insert(
                sanitizedServiceAreas.map((a) => ({
                    supporter_user_id: userData.id,
                    organization_id: organizationContext.organizationId,
                    region_code: a.region_code,
                    country: a.country || 'JP',
                    is_nationwide: false,
                }))
            )
            if (insertError) {
                console.error('[profile] supporter_service_areas insert error:', insertError)
                return serverError()
            }
        }
    }

    return NextResponse.json({ ok: true })
}
