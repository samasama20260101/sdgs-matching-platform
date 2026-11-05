import 'server-only'

// 支える側の API の入口: ログイン → 顔(face=org:<id> / individual)を確かめる
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { parseFaceParam, resolveFace, type ResolvedFace } from './supportCases'

export async function requireFace(request: Request, faceParam: string | null): Promise<{ userId: string; rf: ResolvedFace } | { response: NextResponse }> {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth
  const key = parseFaceParam(faceParam)
  if (!key) return { response: NextResponse.json({ error: '立場を選んでください', code: 'FACE_REQUIRED' }, { status: 400 }) }
  const rf = await resolveFace(auth.appUser.id, key, auth.aal).catch(() => null)
  if (!rf) return { response: NextResponse.json({ error: 'Forbidden', code: 'NOT_YOUR_FACE' }, { status: 403 }) }
  return { userId: auth.appUser.id, rf }
}
