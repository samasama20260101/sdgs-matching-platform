// 支える側から、どの相談が見えるか(盤 03・22、11/5 定例)。
//   - 個人の相談は団体を通して支える。個人の支え手には、会社・地域の相談のうち機微でも18歳未満でもないものだけを出す
//   - 団体は、運営が承認した団体の今いるメンバーだけ。機微な相談の中身は2つ目の確認(AAL2)を通った人だけ
//   - 自分が持ち主・担当の相談と、自分の団体が相談した相談は、支える側には出さない(1アカウントでも相談の秘密を守る)
//   - 関わっている(申し出中・選ばれた)相談は、受付が終わっていても見える

export type CaseForVisibility = {
  status: 'OPEN' | 'MATCHED' | 'RESOLVED' | 'CLOSED' | 'CANCELLED'
  visibility: 'LISTED' | 'UNLISTED' | string
  subject_type: 'PERSON' | 'COMPANY' | 'COMMUNITY' | 'NATION'
  subject_organization_id: string | null
  owner_user_id: string | null
  assignee_user_id: string | null
  is_sensitive: boolean
  is_minor: boolean
}

export type SupporterFace =
  | { kind: 'ORGANIZATION'; userId: string; organizationId: string; organizationApproved: boolean; membershipActive: boolean; mfaVerified: boolean }
  | { kind: 'INDIVIDUAL'; userId: string; profileActive: boolean }

export type CaseAccess = 'NONE' | 'LOCKED' | 'FULL'
// LOCKED = 機微な相談で、2つ目の確認がまだ。件数と「確認すれば見られる」ことだけを出す

const ACTIVE_STATUSES = new Set(['OPEN', 'MATCHED'])

export function isOwnCase(c: CaseForVisibility, face: SupporterFace): boolean {
  if (c.owner_user_id === face.userId || c.assignee_user_id === face.userId) return true
  return face.kind === 'ORGANIZATION' && c.subject_organization_id === face.organizationId
}

export function supporterCaseAccess(
  c: CaseForVisibility,
  face: SupporterFace,
  options: { involved: boolean; requireMfaForSensitive: boolean },
): CaseAccess {
  if (isOwnCase(c, face)) return 'NONE'

  if (face.kind === 'INDIVIDUAL') {
    if (!face.profileActive) return 'NONE'
    if (c.subject_type === 'PERSON' || c.subject_type === 'NATION') return 'NONE'
    if (c.is_sensitive || c.is_minor) return 'NONE'
    if (!options.involved && (c.visibility !== 'LISTED' || !ACTIVE_STATUSES.has(c.status))) return 'NONE'
    return 'FULL'
  }

  if (!face.organizationApproved || !face.membershipActive) return 'NONE'
  if (!options.involved && (c.visibility !== 'LISTED' || !ACTIVE_STATUSES.has(c.status))) return 'NONE'
  if ((c.is_sensitive || c.is_minor) && options.requireMfaForSensitive && !face.mfaVerified) return 'LOCKED'
  return 'FULL'
}

// 申し出られない理由。null なら申し出られる(見えることに加えて、受付中・支援中で、まだ申し出ていない)
//   画面は理由ごとに案内を出す(「いまは申し出られません」だけでは、何をすればよいか分からない。11/11 代表の Staging メモ 6)
export type OfferBlock = 'ALREADY_OFFERED' | 'CLOSED' | 'PHONE_REQUIRED' | 'MFA_REQUIRED' | 'NOT_VISIBLE'

export function offerBlock(c: CaseForVisibility, face: SupporterFace, options: { alreadyOffered: boolean; phoneVerified?: boolean; requireMfaForSensitive: boolean }): OfferBlock | null {
  if (options.alreadyOffered) return 'ALREADY_OFFERED'
  if (!ACTIVE_STATUSES.has(c.status)) return 'CLOSED'
  const access = supporterCaseAccess(c, face, { involved: false, requireMfaForSensitive: options.requireMfaForSensitive })
  if (access === 'NONE') return 'NOT_VISIBLE'
  if (access === 'LOCKED') return 'MFA_REQUIRED'
  // 個人の支え手は電話番号の確認が申し出の条件(10/30 決定 2)
  if (face.kind === 'INDIVIDUAL' && !options.phoneVerified) return 'PHONE_REQUIRED'
  return null
}

export function canOffer(c: CaseForVisibility, face: SupporterFace, options: { alreadyOffered: boolean; phoneVerified?: boolean; requireMfaForSensitive: boolean }): boolean {
  return offerBlock(c, face, options) === null
}
