// 運営への知らせの文面(純粋関数)。相談の中身・呼び名・地域は載せない
export type OpsEvent =
  | { kind: 'NEW_CASE'; displayId: string; subjectType: string; urgent: boolean; sensitive: boolean }
  | { kind: 'REFERRAL_CONSENT'; displayId: string }
  | { kind: 'ORG_APPLICATION'; organizationDisplayId: string }
  | { kind: 'UNMATCHED'; count: number }

const SUBJECT_LABEL: Record<string, string> = { PERSON: '個人', COMPANY: '会社', COMMUNITY: '地域', NATION: '国' }

export function formatOpsEvent(event: OpsEvent): string {
  switch (event.kind) {
    case 'NEW_CASE': {
      const marks = [event.urgent ? '緊急' : null, event.sensitive ? '機微' : null].filter(Boolean).join('・')
      return `新しい相談 ${event.displayId}(${SUBJECT_LABEL[event.subjectType] ?? event.subjectType})${marks ? ` ${marks}` : ''}`
    }
    case 'REFERRAL_CONSENT':
      return `つなぎ先に伝えてよいと選ばれた相談があります ${event.displayId}`
    case 'ORG_APPLICATION':
      return `支え手の団体の申し込みが届きました ${event.organizationDisplayId}`
    case 'UNMATCHED':
      return `24時間申し出のない相談が ${event.count} 件あります`
  }
}
