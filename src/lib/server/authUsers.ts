import 'server-only'

// Auth の利用者をメールアドレスで引く(#155)。supabase-js には引く関数がないので、管理 API の filter(部分一致)で引き、完全一致だけを残す。
// 管理 API の updateUserById は、ほかの利用者が使っているアドレスを指定すると中身のない 500 を返すので、変える前にここで確かめる
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function authUserIdsByEmail(email: string): Promise<string[]> {
  const target = email.toLowerCase()
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(target)}&per_page=50`, {
    headers: { apikey: supabaseServiceKey, authorization: `Bearer ${supabaseServiceKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`auth admin users ${res.status}`)
  const body = (await res.json()) as { users?: { id: string; email?: string | null }[] }
  return (body.users ?? []).filter((u) => (u.email ?? '').toLowerCase() === target).map((u) => u.id)
}
