import 'server-only'

// 相談ごとの最後のメッセージ(やりとりの一覧とホームの「あなたの番」に使う。運営の知らせ SYSTEM は数えない)
import { supabaseAdmin } from '@/lib/supabase/server'
import { previewText, type LastMessage } from '@/lib/domain/talk'

export async function lastMessagesFor(caseIds: readonly string[]): Promise<Map<string, LastMessage>> {
  const result = new Map<string, LastMessage>()
  if (caseIds.length === 0) return result
  // 相談ごとに最後の1件を DB の関数で取る(migrations/v2_08。メッセージの多い相談がほかを押し出さない)
  const { data, error } = await supabaseAdmin.rpc('case_last_messages', { p_case_ids: [...caseIds] })
  if (error) throw error
  for (const m of (data ?? []) as Record<string, unknown>[]) {
    const id = m.case_id as string
    const side = m.sender_role_snapshot === 'SUPPORTER' ? 'SUPPORTER' : 'CONSULTEE'
    result.set(id, {
      at: m.created_at as string,
      preview: previewText(String(m.content ?? '')),
      side,
      senderName: side === 'SUPPORTER'
        ? (m.sender_organization_name_snapshot as string | null) ?? (m.sender_display_name_snapshot as string | null)
        : (m.sender_display_name_snapshot as string | null),
    })
  }
  return result
}
