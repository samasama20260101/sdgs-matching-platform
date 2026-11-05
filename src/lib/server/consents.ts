import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/server'
import { CURRENT_PRIVACY_VERSION, CURRENT_SUPPORTER_TERMS_VERSION, CURRENT_TERMS_VERSION } from '@/lib/validation/person'

// 同意を記録する(版ごとに1行。同じ版にもう一度同意しても増えない)
export async function recordConsents(userId: string) {
  const { error } = await supabaseAdmin.from('user_consents').upsert(
    [
      { user_id: userId, document: 'TERMS', version: CURRENT_TERMS_VERSION },
      { user_id: userId, document: 'PRIVACY', version: CURRENT_PRIVACY_VERSION },
    ],
    { onConflict: 'user_id,document,version', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function recordSupporterConsent(userId: string) {
  const { error } = await supabaseAdmin.from('user_consents').upsert(
    [{ user_id: userId, document: 'SUPPORTER_TERMS', version: CURRENT_SUPPORTER_TERMS_VERSION }],
    { onConflict: 'user_id,document,version', ignoreDuplicates: true },
  )
  if (error) throw error
}
