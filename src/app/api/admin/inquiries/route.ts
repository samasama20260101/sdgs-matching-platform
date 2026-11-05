// src/app/api/admin/inquiries/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { getOrganizationsByUserIds } from '@/lib/organizations'
import { isUuid } from '@/lib/api/validation'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/auth'

const INQUIRY_LIST_MAX = 500

// 運営で、2つ目の確認まで済んだログインだけ(src/lib/api/auth.ts の requireAdmin)
async function verifyAdmin(request: Request) {
    const auth = await requireAdmin(request)
    return 'response' in auth ? null : auth.appUser
}

// GET: 一覧取得
export async function GET(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // OPEN / IN_PROGRESS / CLOSED / null(全件)

    let query = supabaseAdmin
        .from('inquiries')
        .select('id, display_id, user_id, role, name, email, organization, category, message, status, admin_memo, created_at, updated_at, users(display_name, organization_name)')
        .order('created_at', { ascending: false })
        // 本文を含むので、新しい 500 件まで(画面は一覧を全部描く)
        .limit(INQUIRY_LIST_MAX)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
        console.error('[admin/inquiries GET] error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }

    // 団体名の正本は organizations（users.organization_name は移行前の遺物で更新されない）。
    // 未ログイン問い合わせ（user_id なし）と SOS ユーザーは所属団体を持たないため対象外。
    type InquiryRow = {
        user_id: string | null
        users: { display_name: string | null; organization_name: string | null } | null
        [key: string]: unknown
    }
    const inquiries = (data ?? []) as unknown as InquiryRow[]
    // 所属団体と未対応の件数を並べて読む
    const [organizationByUserId, { count: openCount }] = await Promise.all([
        getOrganizationsByUserIds(inquiries.map((i) => i.user_id).filter((id): id is string => Boolean(id))),
        supabaseAdmin.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
    ])
    const inquiriesWithOrganization = inquiries.map((i) => {
        const organization = i.user_id ? organizationByUserId[i.user_id] : undefined
        return i.users
            ? { ...i, users: { ...i.users, organization_name: organization?.name ?? i.users.organization_name } }
            : i
    })

    return NextResponse.json({ inquiries: inquiriesWithOrganization, open_count: openCount ?? 0 })
}

// PATCH: ステータス・メモ更新
export async function PATCH(request: Request) {
    const admin = await verifyAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown; admin_memo?: unknown } | null
    const id = typeof body?.id === 'string' ? body.id : null
    const status = body?.status
    const admin_memo = body?.admin_memo
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    // 状態は決まった値だけ(仕様書 §15: 値を検証していなかった)
    if (status !== undefined && !['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(String(status))) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    if (admin_memo !== undefined && (typeof admin_memo !== 'string' || admin_memo.length > 5000)) return NextResponse.json({ error: 'Invalid memo' }, { status: 400 })
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid inquiry id' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (admin_memo !== undefined) updateData.admin_memo = admin_memo

    const { error } = await supabaseAdmin
        .from('inquiries').update(updateData).eq('id', id)

    if (error) return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    await supabaseAdmin.from('audit_logs').insert({ actor_user_id: admin.id, action: 'admin.inquiry_update', target_table: 'inquiries', target_id: id, metadata: { status } })
    return NextResponse.json({ ok: true })
}
