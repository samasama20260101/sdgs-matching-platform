// 団体の用途と審査の決まり(純粋関数、#131。2026-11-17 代表了承)。団体の用途は 2 つ:
// - 相談のための団体(application.purpose = CONSULT): 会社・地域として相談するために登録した団体。
//   相談するのに承認は要らないので審査の列に並べず(NOT_APPLIED)、支える側の顔にも、招く団体・公開の一覧にも出さない
// - 支え手の団体(purpose = SUPPORT。v1 から移った団体は purpose を持たない): 支え手の決まりへの同意と6つの自己採点をして申し込み、
//   運営の面談のあと承認されると支える側で動ける
// 相談のための団体も、管理の人が支え手の申し込みをすると、同じ団体のまま支え手の団体になる。
// DB も同じ決まりを持つ(migrations/v2_15: 相談のための団体は NOT_APPLIED か SUSPENDED だけ、支え手の団体は NOT_APPLIED にならない)
import { isSupporterPurpose } from './publicSupporter'

export const VETTING_STATUSES = ['NOT_APPLIED', 'APPLIED', 'INTERVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const
export type VettingStatus = (typeof VETTING_STATUSES)[number]

export function isVettingStatus(value: unknown): value is VettingStatus {
  return typeof value === 'string' && (VETTING_STATUSES as readonly string[]).includes(value)
}

// 登録したときの審査の状態。相談のための団体は審査に並べない
export function initialVettingStatus(purpose: 'CONSULT' | 'SUPPORT'): VettingStatus {
  return purpose === 'CONSULT' ? 'NOT_APPLIED' : 'APPLIED'
}

// 運営が変えられる先。相談のための団体は止める・止めるのを解くだけ。支え手の団体は「申し込み前」に戻さない
export function vettingTargets(application: unknown): readonly VettingStatus[] {
  return isSupporterPurpose(application)
    ? ['APPLIED', 'INTERVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']
    : ['NOT_APPLIED', 'SUSPENDED']
}

// 団体として相談できるか。相談のための団体には審査がないので、止めるのは運営が停止したときだけ。
// 見送りは支え手の申し込みを断ったという意味なので、相談は止めない
export function canConsultAsOrganization(vettingStatus: string): boolean {
  return vettingStatus !== 'SUSPENDED'
}

// 今の団体で支え手の申し込みができるか。相談のための団体の、止めていない・申し込み前の団体で、管理の人だけ
export function canApplyAsSupporter(org: { application: unknown; vettingStatus: string; status: string; role: string }): boolean {
  return !isSupporterPurpose(org.application)
    && org.vettingStatus === 'NOT_APPLIED'
    && org.status === 'ACTIVE'
    && org.role === 'OWNER'
}

// 登録のときの申し込みの中身。purpose は最後に置き、送られてきた中身で上書きさせない
// (前は { purpose, ...application } の順で、CONSULT として送って application.purpose = SUPPORT にすると、
//  同意・自己採点・年齢の検査を通らずに支え手の団体ができた)
export function newApplication(purpose: 'CONSULT' | 'SUPPORT', answers: Record<string, string> | undefined): Record<string, string> {
  return { ...(answers ?? {}), purpose }
}

// 相談のための団体が支え手の申し込みをしたときの中身。前の中身に申し込みの答えを足し、用途を SUPPORT にする
export function supporterApplication(current: unknown, answers: Record<string, string>): Record<string, unknown> {
  const base = current && typeof current === 'object' ? (current as Record<string, unknown>) : {}
  return { ...base, ...answers, purpose: 'SUPPORT' }
}

// 支える側の顔に出す団体か。支え手の団体で、見送り・停止でないもの(審査中は出し、承認を待っていると示す)
export function isSupporterFace(org: { supporter: boolean; vettingStatus: string }): boolean {
  return org.supporter && org.vettingStatus !== 'REJECTED' && org.vettingStatus !== 'SUSPENDED'
}
