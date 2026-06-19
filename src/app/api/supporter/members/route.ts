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

type MembershipRow = {
    id: string
    organization_id: string
    user_id: string
    role: OrganizationRole
    status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT'
    joined_at: string | null
    left_at: string | null
    created_at: string
    department: string | null
    external_phone: string | null
    phone_extension: string | null
}

type MembershipStatus = MembershipRow['status']

type SupporterMemberContext = {
    userData: PublicUser
    organizationContext: ActiveOrganizationContext
}

const MANAGER_ROLES: OrganizationRole[] = ['OWNER', 'ADMIN']
const MEMBER_ROLES: OrganizationRole[] = ['OWNER', 'ADMIN', 'MEMBER']
const BLOCKING_MEMBERSHIP_STATUSES: MembershipStatus[] = ['ACTIVE', 'SUSPENDED']

function normalizeEmail(email: unknown) {
    return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function sanitizePhone(phone: unknown) {
    return typeof phone === 'string' && phone.trim()
        ? phone.replace(/[-\s().+]/g, '')
        : null
}

function sanitizeText(value: unknown, maxLength: number) {
    return typeof value === 'string' && value.trim()
        ? value.trim().slice(0, maxLength)
        : null
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

export async function GET(request: Request) {
    const context = await getSupporterMemberContext(request)
    if (!isContext(context)) return context

    const { organizationContext } = context
    const { data: memberships, error: membershipError } = await supabaseAdmin
        .from('organization_memberships')
        .select('id, organization_id, user_id, role, status, joined_at, left_at, created_at, department, external_phone, phone_extension')
        .eq('organization_id', organizationContext.organizationId)
        .order('created_at', { ascending: true })

    if (membershipError) {
        console.error('[supporter/members] membership fetch error:', membershipError)
        return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    const membershipRows = (memberships ?? []) as MembershipRow[]
    const leftUserIds = membershipRows.filter((m) => m.status === 'LEFT').map((m) => m.user_id)
    const usersWithCurrentMembership = new Set<string>()

    if (leftUserIds.length > 0) {
        const { data: currentMemberships, error: currentMembershipsError } = await supabaseAdmin
            .from('organization_memberships')
            .select('user_id')
            .in('user_id', leftUserIds)
            .in('status', BLOCKING_MEMBERSHIP_STATUSES)

        if (currentMembershipsError) {
            console.error('[supporter/members] current membership check error:', currentMembershipsError)
            return NextResponse.json({ error: currentMembershipsError.message }, { status: 500 })
        }

        ;((currentMemberships ?? []) as Array<{ user_id: string }>).forEach((m) => {
            usersWithCurrentMembership.add(m.user_id)
        })
    }

    const visibleMembershipRows = membershipRows.filter((m) => m.status !== 'LEFT' || !usersWithCurrentMembership.has(m.user_id))
    const userIds = visibleMembershipRows.map((m) => m.user_id)
    const usersById: Record<string, PublicUser> = {}

    if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('id, auth_user_id, role, real_name, display_name, email, phone, is_suspended')
            .in('id', userIds)

        if (usersError) {
            console.error('[supporter/members] users fetch error:', usersError)
            return NextResponse.json({ error: usersError.message }, { status: 500 })
        }

        ;((users ?? []) as PublicUser[]).forEach((u) => {
            usersById[u.id] = u
        })
    }

    return NextResponse.json({
        organization: organizationContext.organization,
        my_membership: {
            id: organizationContext.membershipId,
            role: organizationContext.organizationRole,
        },
        members: visibleMembershipRows.map((membership) => ({
            ...membership,
            user: usersById[membership.user_id] ?? null,
        })),
    })
}

export async function POST(request: Request) {
    const context = await getSupporterMemberContext(request)
    if (!isContext(context)) return context

    const { userData, organizationContext } = context
    if (!MANAGER_ROLES.includes(organizationContext.organizationRole)) {
        return NextResponse.json({ error: 'メンバーを追加する権限がありません' }, { status: 403 })
    }

    const body = await request.json()
    if (body.registration_type === 'existing') {
        return NextResponse.json(
            { error: '第一弾では登録済みアカウントの追加・移籍は利用できません。新しいメンバーアカウントを作成してください。', code: 'EXISTING_MEMBER_ADD_DISABLED' },
            { status: 400 }
        )
    }

    const email = normalizeEmail(body.email)
    const realName = typeof body.real_name === 'string' ? body.real_name.trim() : ''
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const externalPhone = sanitizePhone(body.external_phone)
    const department = sanitizeText(body.department, 100)
    const phoneExtension = sanitizeText(body.phone_extension, 30)
    const requestedRole = MEMBER_ROLES.includes(body.role) ? body.role as OrganizationRole : 'MEMBER'
    const memberRole = organizationContext.organizationRole === 'OWNER' ? requestedRole : 'MEMBER'

    if (!email) {
        return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 })
    }

    const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, auth_user_id, role, real_name, display_name, email, phone, is_suspended')
        .eq('email', email)
        .maybeSingle()
    if (existingUser) {
        return NextResponse.json({ error: 'このメールアドレスは登録済みです。第一弾では登録済みアカウントの追加・移籍は利用できません。' }, { status: 409 })
    }

    if (!realName || !password) {
        return NextResponse.json({ error: '新規メンバーは担当者名と初期パスワードが必要です' }, { status: 400 })
    }
    if (password.length < 8 || password.length > 64) {
        return NextResponse.json({ error: '初期パスワードは8文字以上64文字以内で入力してください' }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })
    if (authError || !authData.user) {
        return NextResponse.json({ error: authError?.message ?? 'Authユーザー作成に失敗しました' }, { status: 400 })
    }

    const { data: displayIdRow, error: seqError } = await supabaseAdmin
        .rpc('generate_display_id', { p_role: 'SUPPORTER' })
    if (seqError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: 'ID採番に失敗しました' }, { status: 500 })
    }

    const { data: newUser, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
            auth_user_id: authData.user.id,
            role: 'SUPPORTER',
            real_name: realName,
            display_name: displayName || realName,
            display_id: displayIdRow,
            email,
            phone: externalPhone,
            organization_name: organizationContext.organization.name,
            supporter_type: organizationContext.organization.supporter_type,
            must_change_password: true,
        })
        .select('id, auth_user_id, role, real_name, display_name, email, phone, is_suspended')
        .single()

    if (profileError || !newUser) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: profileError?.message ?? 'プロフィール作成に失敗しました' }, { status: 500 })
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
        .from('organization_memberships')
        .insert({
            organization_id: organizationContext.organizationId,
            user_id: newUser.id,
            role: memberRole,
            status: 'ACTIVE',
            invited_by_user_id: userData.id,
            joined_at: new Date().toISOString(),
            department,
            external_phone: externalPhone,
            phone_extension: phoneExtension,
        })
        .select('id, organization_id, user_id, role, status, joined_at, left_at, created_at, department, external_phone, phone_extension')
        .single()

    if (membershipError || !membership) {
        await supabaseAdmin.from('users').delete().eq('id', newUser.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: membershipError?.message ?? '所属作成に失敗しました' }, { status: 500 })
    }

    await supabaseAdmin.from('audit_logs').insert({
        actor_user_id: userData.id,
        organization_id: organizationContext.organizationId,
        action: 'organization_member_created',
        target_table: 'organization_memberships',
        target_id: membership.id,
        metadata: { user_id: newUser.id, role: memberRole },
    })

    return NextResponse.json({
        reused_existing_user: false,
        member: {
            ...(membership as MembershipRow),
            user: newUser as PublicUser,
        },
    })
}
