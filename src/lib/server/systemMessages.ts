import 'server-only'

// やりとりに出す知らせ(システムのメッセージ)。本文は翻訳のキーにし、画面の言語で出す
import { supabaseAdmin } from '@/lib/supabase/server'

export type SystemKey = 'resolvedConfirmed' | 'resolvedNotYet' | 'resolveReported' | 'offerWithdrawn' | 'cancelled' | 'joined'

export async function postSystemMessage(caseId: string, actorUserId: string, key: SystemKey, params: Record<string, string> = {}) {
  const { error } = await supabaseAdmin.from('messages').insert({
    case_id: caseId,
    sender_user_id: actorUserId,
    content: JSON.stringify({ key, params }),
    message_type: 'SYSTEM',
  })
  if (error) console.error('[systemMessage]', error)
}
