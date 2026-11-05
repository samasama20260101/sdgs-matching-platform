import 'server-only'

// やりとり(相談する側と、選ばれた支え手だけ)。中身は DB にだけ置き、知らせには書かない
import { supabaseAdmin } from '@/lib/supabase/server'
import type { CaseAccess } from './caseAccess'

export const MESSAGE_MAX = 2000
const READ_ONLY_STATUSES = new Set(['RESOLVED', 'CLOSED', 'CANCELLED'])

export type ThreadMessage = {
  id: string
  kind: 'USER' | 'SYSTEM'
  content: string
  system: { key: string; params: Record<string, string> } | null
  mine: boolean
  side: 'CONSULTEE' | 'SUPPORTER'
  senderLabel: string
  originalLanguage: string | null
  translation: string | null
  createdAt: string
}

type MessageRow = {
  id: string
  sender_user_id: string
  sender_organization_id: string | null
  sender_display_name_snapshot: string | null
  sender_organization_name_snapshot: string | null
  sender_role_snapshot: string | null
  content: string
  message_type: 'USER' | 'SYSTEM'
  original_language: string | null
  created_at: string
}

export function isThreadOpen(status: string) {
  return !READ_ONLY_STATUSES.has(status)
}

function parseSystem(content: string): { key: string; params: Record<string, string> } | null {
  try {
    const v = JSON.parse(content) as { key?: unknown; params?: unknown }
    if (typeof v.key !== 'string') return null
    return { key: v.key, params: v.params && typeof v.params === 'object' ? (v.params as Record<string, string>) : {} }
  } catch {
    return null
  }
}

export async function listThread(access: CaseAccess, userId: string, lang: string | null): Promise<ThreadMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, sender_user_id, sender_organization_id, sender_display_name_snapshot, sender_organization_name_snapshot, sender_role_snapshot, content, message_type, original_language, created_at')
    .eq('case_id', access.caseRow.id)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) throw error
  const rows = (data ?? []) as MessageRow[]
  let translations = new Map<string, string>()
  if (lang && rows.length > 0) {
    const { data: tr } = await supabaseAdmin
      .from('message_translations')
      .select('message_id, content')
      .eq('language', lang)
      .in('message_id', rows.map((r) => r.id))
    translations = new Map((tr ?? []).map((t) => [t.message_id as string, t.content as string]))
  }
  return rows.map((r) => {
    const side: ThreadMessage['side'] = r.sender_role_snapshot === 'SUPPORTER' ? 'SUPPORTER' : 'CONSULTEE'
    const label = side === 'SUPPORTER'
      ? [r.sender_organization_name_snapshot, r.sender_display_name_snapshot].filter(Boolean).join(' ')
      : r.sender_display_name_snapshot ?? ''
    return {
      id: r.id,
      kind: r.message_type,
      content: r.message_type === 'SYSTEM' ? '' : r.content,
      system: r.message_type === 'SYSTEM' ? parseSystem(r.content) : null,
      mine: r.sender_user_id === userId,
      side,
      senderLabel: label,
      originalLanguage: r.original_language,
      translation: translations.get(r.id) ?? null,
      createdAt: r.created_at,
    }
  })
}

export async function postUserMessage(access: CaseAccess, userId: string, content: string) {
  const { data: me, error: meErr } = await supabaseAdmin.from('users').select('display_name, locale').eq('id', userId).single()
  if (meErr) throw meErr
  let organizationName: string | null = null
  let displayName = me.display_name as string
  if (access.role === 'SUPPORTER' && access.organizationId) {
    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', access.organizationId).single()
    organizationName = (org?.name as string | undefined) ?? null
  } else if (access.role === 'SUPPORTER') {
    const { data: profile } = await supabaseAdmin.from('supporter_profiles').select('real_name').eq('user_id', userId).maybeSingle()
    displayName = (profile?.real_name as string | undefined) ?? displayName
  } else if (access.caseRow.subject_organization_id) {
    // 会社・地域の相談は団体の名前で出す(担当者の呼び名は出さない、盤 16)
    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', access.caseRow.subject_organization_id).single()
    displayName = (org?.name as string | undefined) ?? displayName
  }
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      case_id: access.caseRow.id,
      sender_user_id: userId,
      sender_organization_id: access.role === 'SUPPORTER' ? access.organizationId : null,
      sender_display_name_snapshot: displayName,
      sender_organization_name_snapshot: organizationName,
      sender_role_snapshot: access.role === 'SUPPORTER' ? 'SUPPORTER' : 'CONSULTEE',
      content,
      message_type: 'USER',
      original_language: me.locale as string,
    })
    .select('id')
    .single()
  if (error) throw error
  await supabaseAdmin.from('cases').update({ updated_at: new Date().toISOString() }).eq('id', access.caseRow.id)
  return data.id as string
}
