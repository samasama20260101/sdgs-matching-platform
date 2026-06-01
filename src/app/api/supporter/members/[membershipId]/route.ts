import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser, type ActiveOrganizationContext, type OrganizationRole } from '@/lib/organizations'
import { NextResponse } from 'next/server'

type PublicUser = {
    id: string
    auth_user_id: string
    role: string
    real_name: string
    display_name: string
    email: string
    phone: string | null
    is_suspended: boolean | null
}

type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT'

type MembershipRow = {
    id: string
    organization_id: string
    user_id: string
    role: OrganizationRole
    status: MembershipStatus
    joined_at: string | null
    left_at: string | null
    created_at: string
    department: string | null
    external_phone: string | null
    phone_extension: string | null
    admin_note: string | null
}

type SupporterMemberContext = {
    userData: PublicUser
    organizationContext: ActiveOrganizationContext
}

const MEMBER_ROLES: OrganizationRole[] = ['OWNER', 'ADMIN', 'MEMBER']
const UPDATE_STATUSES: MembershipStatus[] = ['ACTIVE', 'SUSPENDED', 'LEFT']
const DETAIL_FIELDS = ['department', 'external_phone', 'phone_extension', 'admin_note'] as const

function sanitizeDetail(value: unknown, maxLength: number) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null
}

async function getSupporterMemberContext(request: Request): Promise<SupporterMemberContext | NextResponse> {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, auth_user_id, role, real_name, display_name, email, phone, is_suspended')
        .eq('auth_user_id', user.id)
        .single()

    if (!userData || userData.role !== 'SUPPORTER') {
        return NextResponse.json({ error: 'アクセス権限がありません', code: 'FORBIDDEN' }, { status: 403 })
    }
    if (userData.is_suspended) {
        return NextResponse.json({ error: 'このアカウントは停止されています', code: 'ACCOUNT_SUSPENDED' }, { status: 403 })
    }

    const organizationContext = await getActiveOrganizationForUser(userData.id)
    if (!organizationContext) {
        return NextResponse.json({ error: '有効な団体所属がありません', code: 'NO_ACTIVE_ORGANIZATION' }, { status: 403 })
    }

    return { userData: userData as PublicUser, organizationContext }
}

function isContext(value: SupporterMemberContext | NextResponse): value is SupporterMemberContext {
    return !(value instanceof NextResponse)
}

async function getActiveOwnerCount(organizationId: string) {
    const { count, error } = await supabaseAdmin
        .from('organization_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'OWNER')
        .eq('status', 'ACTIVE')

    if (error) {
        console.error('[supporter/members] active owner count error:', error)
        return null
    }
    return count ?? 0
}

export async function PATCH(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
    const { membershipId } = await params
    const context = await getSupporterMemberContext(request)
    if (!isContext(context)) return context

    const { userData, organizationContext } = context
    if (organizationContext.organizationRole !== 'OWNER') {
        return NextResponse.json({ error: 'メンバーを変更する権限がありません' }, { status: 403 })
    }

    const { data: targetMembership, error: targetError } = await supabaseAdmin
        .from('organization_memberships')
        .select('id, organization_id, user_id, role, status, joined_at, left_at, created_at, department, external_phone, phone_extension, admin_note')
        .eq('id', membershipId)
        .eq('organization_id', organizationContext.organizationId)
        .single()

    if (targetError || !targetMembership) {
        return NextResponse.json({ error: '対象メンバーが見つかりません' }, { status: 404 })
    }

    const target = targetMembership as MembershipRow
    const body = await request.json()
    const nextRole = MEMBER_ROLES.includes(body.role) ? body.role as OrganizationRole : undefined
    const nextStatus = UPDATE_STATUSES.includes(body.status) ? body.status as MembershipStatus : undefined

    const hasDetails = DETAIL_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field))
    if (!nextRole && !nextStatus && !hasDetails) {
        return NextResponse.json({ error: '変更内容がありません' }, { status: 400 })
    }

    if (nextStatus && target.id === organizationContext.membershipId) {
        return NextResponse.json({ error: '自分自身の所属状態は変更できません' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    const auditMetadata: Record<string, unknown> = {
        user_id: target.user_id,
        previous_role: target.role,
        previous_status: target.status,
    }

    if (hasDetails) {
        updateData.department = sanitizeDetail(body.department, 100)
        updateData.external_phone = sanitizeDetail(body.external_phone, 30)
        updateData.phone_extension = sanitizeDetail(body.phone_extension, 30)
        updateData.admin_note = sanitizeDetail(body.admin_note, 1000)
        auditMetadata.details_updated = true
    }

    if (nextRole && nextRole !== target.role) {
        if (target.status !== 'ACTIVE') {
            return NextResponse.json({ error: '停止中または解除済みのメンバーは権限変更できません' }, { status: 400 })
        }
        if (target.id === organizationContext.membershipId && target.role === 'OWNER' && nextRole !== 'OWNER') {
            const ownerCount = await getActiveOwnerCount(organizationContext.organizationId)
            if (ownerCount === null) {
                return NextResponse.json({ error: 'OWNER確認に失敗しました' }, { status: 500 })
            }
            if (ownerCount <= 1) {
                return NextResponse.json({ error: '最後のOWNERは変更できません' }, { status: 400 })
            }
        }
        updateData.role = nextRole
        auditMetadata.next_role = nextRole
    }

    if (nextStatus && nextStatus !== target.status) {
        if (target.role === 'OWNER' && target.status === 'ACTIVE' && nextStatus !== 'ACTIVE') {
            const ownerCount = await getActiveOwnerCount(organizationContext.organizationId)
            if (ownerCount === null) {
                return NextResponse.json({ error: 'OWNER確認に失敗しました' }, { status: 500 })
            }
            if (ownerCount <= 1) {
                return NextResponse.json({ error: '最後のOWNERは停止・解除できません' }, { status: 400 })
            }
        }

        updateData.status = nextStatus
        auditMetadata.next_status = nextStatus
        if (nextStatus === 'ACTIVE') {
            const { data: activeMemberships, error: activeMembershipsError } = await supabaseAdmin
                .from('organization_memberships')
                .select('id, organization_id')
                .eq('user_id', target.user_id)
                .eq('status', 'ACTIVE')
                .neq('id', target.id)

            if (activeMembershipsError) {
                return NextResponse.json({ error: activeMembershipsError.message }, { status: 500 })
            }
            if ((activeMemberships ?? []).length > 0) {
                return NextResponse.json({ error: 'このユーザーは既に別団体に所属しています', code: 'ACTIVE_MEMBERSHIP_EXISTS' }, { status: 409 })
            }
            updateData.left_at = null
        }
        if (nextStatus === 'LEFT') {
            updateData.left_at = new Date().toISOString()
        }
    }

    const { data: updatedMembership, error: updateError } = await supabaseAdmin
        .from('organization_memberships')
        .update(updateData)
        .eq('id', target.id)
        .select('id, organization_id, user_id, role, status, joined_at, left_at, created_at, department, external_phone, phone_extension, admin_note')
        .single()

    if (updateError || !updatedMembership) {
        return NextResponse.json({ error: updateError?.message ?? 'メンバー更新に失敗しました' }, { status: 500 })
    }

    if (nextStatus && nextStatus !== 'LEFT') {
        const { error: userStatusError } = await supabaseAdmin
            .from('users')
            .update({ is_suspended: nextStatus !== 'ACTIVE' })
            .eq('id', target.user_id)

        if (userStatusError) {
            console.error('[supporter/members] user suspension update error:', userStatusError)
            return NextResponse.json({ error: userStatusError.message }, { status: 500 })
        }
    }
    if (nextStatus === 'LEFT') {
        const { error: userStatusError } = await supabaseAdmin
            .from('users')
            .update({ is_suspended: false })
            .eq('id', target.user_id)

        if (userStatusError) {
            console.error('[supporter/members] user suspension update error:', userStatusError)
            return NextResponse.json({ error: userStatusError.message }, { status: 500 })
        }
    }

    await supabaseAdmin.from('audit_logs').insert({
        actor_user_id: userData.id,
        organization_id: organizationContext.organizationId,
        action: 'organization_member_updated',
        target_table: 'organization_memberships',
        target_id: target.id,
        metadata: auditMetadata,
    })

    return NextResponse.json({ member: updatedMembership as MembershipRow })
}
