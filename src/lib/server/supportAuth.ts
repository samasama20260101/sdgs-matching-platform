import 'server-only'

// 支える側の API の入口: ログイン → 顔(face=org:<id> / individual)を確かめる
import { NextResponse } from 'next/server'
import { requireActiveAppUser } from '@/lib/api/auth'
import { canSupportNow } from '@/lib/faces'
import { parseFaceParam, resolveFace, type ResolvedFace } from './supportCases'

export function underSupporterAgeResponse() {
  return NextResponse.json({ error: '支える側として活動できるのは18歳からです', code: 'UNDER_SUPPORTER_AGE' }, { status: 403 })
}

export async function requireFace(request: Request, faceParam: string | null): Promise<{ userId: string; rf: ResolvedFace } | { response: NextResponse }> {
  const auth = await requireActiveAppUser(request, { roles: ['PERSON'] })
  if ('response' in auth) return auth
  const key = parseFaceParam(faceParam)
  if (!key) return { response: NextResponse.json({ error: '立場を選んでください', code: 'FACE_REQUIRED' }, { status: 400 }) }
  const [rf, allowed] = await Promise.all([resolveFace(auth.appUser.id, key, auth.aal).catch(() => null), canSupportNow(auth.appUser.id)])
  if (!rf) return { response: NextResponse.json({ error: 'Forbidden', code: 'NOT_YOUR_FACE' }, { status: 403 }) }
  // あとから年齢を直して18歳未満になった人も、ここで止まる
  if (!allowed) return { response: underSupporterAgeResponse() }
  return { userId: auth.appUser.id, rf }
}
