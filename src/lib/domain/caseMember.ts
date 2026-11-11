// 団体の中で、相談を受け持つメンバー(#118、11/11 代表の検討キャンバス 5)。
//   団体の申し出(offers)の supporter_user_id を「受け持つメンバー」として扱う。created_by_user_id は申し出た人の記録のまま。
//   団体の相談とやりとりは、受け持つメンバーに限らず、今いるメンバー全員が読める(visibility.ts・caseAccess.ts)。
//   受け持つメンバーは、知らせ(選ばれた・新しいやりとり)とありがとうの宛先を決める。

export type CaseMemberOrgRole = 'OWNER' | 'MEMBER'

// 受け持つメンバーを替えられる申し出の状態。招かれたまま(INVITED)は、まだ相手の団体のだれも受けていないので替えない
const CHANGEABLE_OFFER_STATUSES = new Set(['PENDING', 'ACCEPTED'])

export function isMemberChangeableOffer(status: string): boolean {
  return CHANGEABLE_OFFER_STATUSES.has(status)
}

// 替えられるのは、団体の管理の人と、いま受け持っている本人
export function canChangeCaseMember(actor: { userId: string; role: CaseMemberOrgRole }, currentMemberUserId: string | null): boolean {
  if (actor.role === 'OWNER') return true
  return currentMemberUserId !== null && actor.userId === currentMemberUserId
}

// 替える相手は、団体の今いるメンバーで、いまの人と違う人
export function isValidNextMember(targetUserId: string, activeMemberUserIds: readonly string[], currentMemberUserId: string | null): boolean {
  return targetUserId !== currentMemberUserId && activeMemberUserIds.includes(targetUserId)
}

// 知らせとありがとうの宛先(受け持つメンバー。古い行で空なら申し出た人)
export function offerMemberUserId(o: { supporter_user_id: string | null; created_by_user_id: string | null }): string | null {
  return o.supporter_user_id ?? o.created_by_user_id
}
