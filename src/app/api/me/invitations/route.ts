// わたしに届いている団体への招待(ログイン中のメールに来たもの)
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth.response
  const email = auth.authUser.email?.toLowerCase()
  if (!email) return NextResponse.json({ invitations: [] })
  const { data } = await supabaseAdmin
    .from('organization_invitations')
    .select('id, role, expires_at, organizations(name)')
    .eq('status', 'PENDING')
    .ilike('email', email)
    .gt('expires_at', new Date().toISOString())
  return NextResponse.json({
    invitations: (data ?? []).map((i) => ({ id: i.id, role: i.role, expiresAt: i.expires_at, organizationName: (i.organizations as unknown as { name?: string } | null)?.name ?? '' })),
  })
}
