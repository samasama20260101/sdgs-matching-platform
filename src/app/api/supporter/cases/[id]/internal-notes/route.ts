import { supabaseAdmin } from '@/lib/supabase/server'
import { getActiveOrganizationForUser } from '@/lib/organizations'
import { NextResponse } from 'next/server'

const NOTE_VISIBILITIES = new Set(['ORGANIZATION_ONLY', 'APPROVED_SUPPORTERS'])
const MAX_NOTE_LENGTH = 3000

type NoteVisibility = 'ORGANIZATION_ONLY' | 'APPROVED_SUPPORTERS'

type SupporterContext = {
    userId: string
    organizationId: string
}

type InternalNoteRow = {
    id: string
    case_id: string
    organization_id: string
    author_user_id: string
    visibility: NoteVisibility
    body: string
    created_at: string
    updated_at: string
}

async function getSupporterContext(request: Request, caseId: string): Promise<SupporterContext | NextResponse> {
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
        .select('id, role, is_suspended')
        .eq('auth_user_id', user.id)
        .single()
    if (!userData || userData.role !== 'SUPPORTER' || userData.is_suspended) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organizationContext = await getActiveOrganizationForUser(userData.id)
    if (!organizationContext) {
        return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    }

    const { data: acceptedOffer } = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('case_id', caseId)
        .eq('supporter_organization_id', organizationContext.organizationId)
        .eq('status', 'ACCEPTED')
        .maybeSingle()
    if (!acceptedOffer) {
        return NextResponse.json({ error: 'Not authorized for this case' }, { status: 403 })
    }

    return {
        userId: userData.id,
        organizationId: organizationContext.organizationId,
    }
}

function isContext(context: SupporterContext | NextResponse): context is SupporterContext {
    return !(context instanceof NextResponse)
}

function sanitizeBody(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

async function recordAuditLog(
    context: SupporterContext,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>
) {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
        actor_user_id: context.userId,
        organization_id: context.organizationId,
        action,
        target_table: 'case_internal_notes',
        target_id: targetId,
        metadata,
    })
    if (error) console.error('[internal-notes] audit log error:', error)
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: caseId } = await params
    const context = await getSupporterContext(request, caseId)
    if (!isContext(context)) return context

    const { data: notes, error } = await supabaseAdmin
        .from('case_internal_notes')
        .select('id, case_id, organization_id, author_user_id, visibility, body, created_at, updated_at')
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const visibleNotes = ((notes || []) as InternalNoteRow[]).filter((note) =>
        note.visibility === 'APPROVED_SUPPORTERS'
        || (note.visibility === 'ORGANIZATION_ONLY' && note.organization_id === context.organizationId)
    )

    const authorIds = [...new Set(visibleNotes.map((note) => note.author_user_id).filter(Boolean))]
    const organizationIds = [...new Set(visibleNotes.map((note) => note.organization_id).filter(Boolean))]
    const [{ data: authors }, { data: organizations }] = await Promise.all([
        authorIds.length > 0
            ? supabaseAdmin.from('users').select('id, display_name').in('id', authorIds)
            : Promise.resolve({ data: [] }),
        organizationIds.length > 0
            ? supabaseAdmin.from('organizations').select('id, name').in('id', organizationIds)
            : Promise.resolve({ data: [] }),
    ])

    const authorMap = Object.fromEntries((authors || []).map((author: { id: string; display_name: string }) => [author.id, author.display_name]))
    const organizationMap = Object.fromEntries((organizations || []).map((organization: { id: string; name: string }) => [organization.id, organization.name]))

    return NextResponse.json({
        notes: visibleNotes.map((note) => ({
            ...note,
            author_display_name: authorMap[note.author_user_id] || '不明',
            organization_name: organizationMap[note.organization_id] || '不明',
            can_edit: note.author_user_id === context.userId,
        })),
    })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: caseId } = await params
    const context = await getSupporterContext(request, caseId)
    if (!isContext(context)) return context

    const body = await request.json()
    const visibility = NOTE_VISIBILITIES.has(body.visibility) ? body.visibility as NoteVisibility : null
    const noteBody = sanitizeBody(body.body)
    if (!visibility || !noteBody) {
        return NextResponse.json({ error: 'visibility and body are required' }, { status: 400 })
    }
    if (noteBody.length > MAX_NOTE_LENGTH) {
        return NextResponse.json({ error: `body must be ${MAX_NOTE_LENGTH} characters or less` }, { status: 400 })
    }

    const { data: note, error } = await supabaseAdmin
        .from('case_internal_notes')
        .insert({
            case_id: caseId,
            organization_id: context.organizationId,
            author_user_id: context.userId,
            visibility,
            body: noteBody,
        })
        .select('id')
        .single()
    if (error || !note) {
        return NextResponse.json({ error: error?.message ?? 'メモの登録に失敗しました' }, { status: 500 })
    }

    await recordAuditLog(context, 'case_internal_note_created', note.id, { case_id: caseId, visibility })
    return NextResponse.json({ ok: true, id: note.id })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: caseId } = await params
    const context = await getSupporterContext(request, caseId)
    if (!isContext(context)) return context

    const body = await request.json()
    const noteId = typeof body.note_id === 'string' ? body.note_id : ''
    const noteBody = sanitizeBody(body.body)
    if (!noteId || !noteBody) {
        return NextResponse.json({ error: 'note_id and body are required' }, { status: 400 })
    }
    if (noteBody.length > MAX_NOTE_LENGTH) {
        return NextResponse.json({ error: `body must be ${MAX_NOTE_LENGTH} characters or less` }, { status: 400 })
    }

    const { data: note } = await supabaseAdmin
        .from('case_internal_notes')
        .select('id, author_user_id, organization_id')
        .eq('id', noteId)
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .maybeSingle()
    if (!note || note.author_user_id !== context.userId || note.organization_id !== context.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
        .from('case_internal_notes')
        .update({ body: noteBody, updated_by_user_id: context.userId })
        .eq('id', noteId)
        .is('deleted_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recordAuditLog(context, 'case_internal_note_updated', noteId, { case_id: caseId })
    return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: caseId } = await params
    const context = await getSupporterContext(request, caseId)
    if (!isContext(context)) return context

    const body = await request.json()
    const noteId = typeof body.note_id === 'string' ? body.note_id : ''
    if (!noteId) return NextResponse.json({ error: 'note_id is required' }, { status: 400 })

    const { data: note } = await supabaseAdmin
        .from('case_internal_notes')
        .select('id, author_user_id, organization_id')
        .eq('id', noteId)
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .maybeSingle()
    if (!note || note.author_user_id !== context.userId || note.organization_id !== context.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
        .from('case_internal_notes')
        .update({ deleted_at: new Date().toISOString(), deleted_by_user_id: context.userId })
        .eq('id', noteId)
        .is('deleted_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recordAuditLog(context, 'case_internal_note_deleted', noteId, { case_id: caseId })
    return NextResponse.json({ ok: true })
}
