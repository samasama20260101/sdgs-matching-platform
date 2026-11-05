// わたしに届いている団体への招待(ログイン中のメールに来たもの)
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  // 確かめ済みのメールだけで照らし合わせる。ilike だと _ と % が「どんな文字でも」に効くので、完全一致にする(招待は小文字で保存している)
  const email = auth.authUser.email_confirmed_at ? auth.authUser.email?.toLowerCase() : undefined
  if (!email) return NextResponse.json({ invitations: [] })
  const { data } = await supabaseAdmin
    .from('organization_invitations')
    .select('id, role, expires_at, organizations(name)')
    .eq('status', 'PENDING')
    .eq('email', email)
    .gt('expires_at', new Date().toISOString())
  return NextResponse.json({
    invitations: (data ?? []).map((i) => ({ id: i.id, role: i.role, expiresAt: i.expires_at, organizationName: (i.organizations as unknown as { name?: string } | null)?.name ?? '' })),
  })
}
